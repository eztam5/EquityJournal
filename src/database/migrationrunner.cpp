#include "migrationrunner.h"

#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QSet>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>

namespace {
bool fail(QString *errorMessage, const QString &message)
{
    if (errorMessage)
        *errorMessage = message;
    return false;
}
}

bool MigrationRunner::migrate(const QString &connectionName, QString *errorMessage)
{
    auto database = QSqlDatabase::database(connectionName);
    if (!database.isOpen())
        return fail(errorMessage, QStringLiteral("The database connection is not open."));

    QSqlQuery createHistory(database);
    if (!createHistory.exec(QStringLiteral(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "version TEXT PRIMARY KEY, "
            "applied_at TEXT NOT NULL)"))) {
        return fail(errorMessage,
                    QStringLiteral("Could not create migration history: %1")
                        .arg(createHistory.lastError().text()));
    }

    QSet<QString> appliedVersions;
    QSqlQuery history(database);
    if (!history.exec(QStringLiteral("SELECT version FROM schema_migrations"))) {
        return fail(errorMessage,
                    QStringLiteral("Could not read migration history: %1")
                        .arg(history.lastError().text()));
    }
    while (history.next())
        appliedVersions.insert(history.value(0).toString());

    const QDir migrationDirectory(QStringLiteral(":/migrations"));
    const QStringList migrationFiles = migrationDirectory.entryList(
        { QStringLiteral("*.sql") }, QDir::Files, QDir::Name);

    if (migrationFiles.isEmpty())
        return fail(errorMessage, QStringLiteral("No database migrations were found."));

    for (const QString &fileName : migrationFiles) {
        if (appliedVersions.contains(fileName))
            continue;

        QFile migrationFile(migrationDirectory.filePath(fileName));
        if (!migrationFile.open(QIODevice::ReadOnly | QIODevice::Text)) {
            return fail(errorMessage,
                        QStringLiteral("Could not read migration %1: %2")
                            .arg(fileName, migrationFile.errorString()));
        }

        const QString script = QString::fromUtf8(migrationFile.readAll());
        const QStringList statements = splitStatements(script);
        if (statements.isEmpty())
            return fail(errorMessage, QStringLiteral("Migration %1 is empty.").arg(fileName));

        if (!database.transaction()) {
            return fail(errorMessage,
                        QStringLiteral("Could not start migration %1: %2")
                            .arg(fileName, database.lastError().text()));
        }

        bool migrationSucceeded = true;
        QString failureMessage;
        for (const QString &statement : statements) {
            QSqlQuery query(database);
            if (!query.exec(statement)) {
                migrationSucceeded = false;
                failureMessage = QStringLiteral("Migration %1 failed: %2")
                                     .arg(fileName, query.lastError().text());
                break;
            }
        }

        if (migrationSucceeded) {
            QSqlQuery recordMigration(database);
            recordMigration.prepare(QStringLiteral(
                "INSERT INTO schema_migrations (version, applied_at) "
                "VALUES (:version, :applied_at)"));
            recordMigration.bindValue(QStringLiteral(":version"), fileName);
            recordMigration.bindValue(
                QStringLiteral(":applied_at"),
                QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs));
            if (!recordMigration.exec()) {
                migrationSucceeded = false;
                failureMessage = QStringLiteral("Could not record migration %1: %2")
                                     .arg(fileName, recordMigration.lastError().text());
            }
        }

        if (!migrationSucceeded) {
            database.rollback();
            return fail(errorMessage, failureMessage);
        }

        if (!database.commit()) {
            database.rollback();
            return fail(errorMessage,
                        QStringLiteral("Could not commit migration %1: %2")
                            .arg(fileName, database.lastError().text()));
        }
    }

    return true;
}

QStringList MigrationRunner::splitStatements(const QString &script)
{
    QStringList statements;
    QString current;
    bool inSingleQuote = false;
    bool inDoubleQuote = false;
    bool inLineComment = false;
    bool inBlockComment = false;

    for (qsizetype i = 0; i < script.size(); ++i) {
        const QChar character = script.at(i);
        const QChar next = i + 1 < script.size() ? script.at(i + 1) : QChar();

        if (inLineComment) {
            if (character == QLatin1Char('\n')) {
                inLineComment = false;
                current.append(character);
            }
            continue;
        }

        if (inBlockComment) {
            if (character == QLatin1Char('*') && next == QLatin1Char('/')) {
                inBlockComment = false;
                ++i;
            }
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (character == QLatin1Char('-') && next == QLatin1Char('-')) {
                inLineComment = true;
                ++i;
                continue;
            }
            if (character == QLatin1Char('/') && next == QLatin1Char('*')) {
                inBlockComment = true;
                ++i;
                continue;
            }
        }

        if (character == QLatin1Char('\'') && !inDoubleQuote) {
            current.append(character);
            if (inSingleQuote && next == QLatin1Char('\'')) {
                current.append(next);
                ++i;
            } else {
                inSingleQuote = !inSingleQuote;
            }
            continue;
        }

        if (character == QLatin1Char('"') && !inSingleQuote) {
            current.append(character);
            if (inDoubleQuote && next == QLatin1Char('"')) {
                current.append(next);
                ++i;
            } else {
                inDoubleQuote = !inDoubleQuote;
            }
            continue;
        }

        if (character == QLatin1Char(';') && !inSingleQuote && !inDoubleQuote) {
            const QString statement = current.trimmed();
            if (!statement.isEmpty())
                statements.append(statement);
            current.clear();
            continue;
        }

        current.append(character);
    }

    const QString finalStatement = current.trimmed();
    if (!finalStatement.isEmpty())
        statements.append(finalStatement);

    return statements;
}
