#include "databasemanager.h"

#include "migrationrunner.h"

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QStandardPaths>

#include <utility>

namespace {
constexpr auto ConnectionName = "equity-journal";
constexpr auto DatabaseFileName = "equity-journal.sqlite3";
constexpr auto LegacyDatabaseFileName = "investment-journal.sqlite3";
constexpr auto DatabasePathEnvironmentVariable = "EQUITY_JOURNAL_DB_PATH";
constexpr auto LegacyDatabasePathEnvironmentVariable = "INVESTMENT_JOURNAL_DB_PATH";
}

DatabaseManager::DatabaseManager(QString databasePath)
    : m_requestedDatabasePath(std::move(databasePath))
    , m_connectionName(QString::fromLatin1(ConnectionName))
{
}

DatabaseManager::~DatabaseManager()
{
    if (!QSqlDatabase::contains(m_connectionName))
        return;

    {
        auto database = QSqlDatabase::database(m_connectionName, false);
        database.close();
    }
    QSqlDatabase::removeDatabase(m_connectionName);
}

bool DatabaseManager::initialize(QString *errorMessage)
{
    if (m_initialized)
        return true;

    m_databasePath = resolvedDatabasePath();
    const QFileInfo databaseFile(m_databasePath);
    if (!QDir().mkpath(databaseFile.absolutePath())) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not create the database directory: %1")
                                .arg(databaseFile.absolutePath());
        return false;
    }

    const bool usesDefaultPath = m_requestedDatabasePath.isEmpty()
        && !qEnvironmentVariableIsSet(DatabasePathEnvironmentVariable)
        && !qEnvironmentVariableIsSet(LegacyDatabasePathEnvironmentVariable);
    const QString legacyPath = legacyDatabasePath();
    if (usesDefaultPath
        && !databaseFile.exists()
        && QFileInfo::exists(legacyPath)
        && !QFile::copy(legacyPath, m_databasePath)) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not migrate the existing database to %1")
                                .arg(m_databasePath);
        return false;
    }

    auto database = QSqlDatabase::addDatabase(QStringLiteral("QSQLITE"), m_connectionName);
    database.setDatabaseName(m_databasePath);
    database.setConnectOptions(QStringLiteral("QSQLITE_BUSY_TIMEOUT=5000"));

    if (!database.open()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not open the SQLite database: %1")
                                .arg(database.lastError().text());
        return false;
    }

    QSqlQuery foreignKeys(database);
    if (!foreignKeys.exec(QStringLiteral("PRAGMA foreign_keys = ON"))) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not enable SQLite foreign keys: %1")
                                .arg(foreignKeys.lastError().text());
        return false;
    }

    if (!MigrationRunner::migrate(m_connectionName, errorMessage))
        return false;

    m_initialized = true;
    return true;
}

QString DatabaseManager::connectionName() const
{
    return m_connectionName;
}

QString DatabaseManager::databasePath() const
{
    return m_databasePath;
}

QString DatabaseManager::resolvedDatabasePath() const
{
    if (!m_requestedDatabasePath.isEmpty())
        return QFileInfo(m_requestedDatabasePath).absoluteFilePath();

    const QString environmentPath = qEnvironmentVariable(DatabasePathEnvironmentVariable);
    if (!environmentPath.isEmpty())
        return QFileInfo(environmentPath).absoluteFilePath();

    const QString legacyEnvironmentPath =
        qEnvironmentVariable(LegacyDatabasePathEnvironmentVariable);
    if (!legacyEnvironmentPath.isEmpty())
        return QFileInfo(legacyEnvironmentPath).absoluteFilePath();

    return QDir(QStandardPaths::writableLocation(QStandardPaths::AppDataLocation))
        .filePath(QString::fromLatin1(DatabaseFileName));
}

QString DatabaseManager::legacyDatabasePath() const
{
    return QDir(QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation))
        .filePath(QStringLiteral("Investment Journal/Investment Journal/%1")
                      .arg(QString::fromLatin1(LegacyDatabaseFileName)));
}
