#include "sqlsecuritynoterepository.h"

#include <QDateTime>
#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>

#include <utility>

SqlSecurityNoteRepository::SqlSecurityNoteRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

SecurityNoteRecord SqlSecurityNoteRepository::find(
    const QString &securityId,
    QString *errorMessage) const
{
    QSqlQuery query(QSqlDatabase::database(m_connectionName));
    query.prepare(QStringLiteral(
        "SELECT security_id, content_html, updated_at FROM security_notes "
        "WHERE security_id = :security_id"));
    query.bindValue(QStringLiteral(":security_id"), securityId);
    if (!query.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load the security note: %1")
                                .arg(query.lastError().text());
        return {};
    }

    if (errorMessage)
        errorMessage->clear();
    if (!query.next())
        return { securityId, {}, {} };

    return {
        query.value(0).toString(),
        query.value(1).toString(),
        query.value(2).toString()
    };
}

bool SqlSecurityNoteRepository::save(const QString &securityId,
                                     const QString &contentHtml,
                                     SecurityNoteRecord *savedNote,
                                     QString *errorMessage)
{
    auto database = QSqlDatabase::database(m_connectionName);
    const QString updatedAt =
        QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);

    QSqlQuery updateQuery(database);
    updateQuery.prepare(QStringLiteral(
        "UPDATE security_notes SET content_html = :content_html, updated_at = :updated_at "
        "WHERE security_id = :security_id"));
    updateQuery.bindValue(QStringLiteral(":content_html"), contentHtml);
    updateQuery.bindValue(QStringLiteral(":updated_at"), updatedAt);
    updateQuery.bindValue(QStringLiteral(":security_id"), securityId);
    if (!updateQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not save the security note: %1")
                                .arg(updateQuery.lastError().text());
        return false;
    }

    if (updateQuery.numRowsAffected() == 0) {
        QSqlQuery insertQuery(database);
        insertQuery.prepare(QStringLiteral(
            "INSERT INTO security_notes (security_id, content_html, updated_at) "
            "VALUES (:security_id, :content_html, :updated_at)"));
        insertQuery.bindValue(QStringLiteral(":security_id"), securityId);
        insertQuery.bindValue(QStringLiteral(":content_html"), contentHtml);
        insertQuery.bindValue(QStringLiteral(":updated_at"), updatedAt);
        if (!insertQuery.exec()) {
            if (errorMessage)
                *errorMessage = QStringLiteral("Could not save the security note: %1")
                                    .arg(insertQuery.lastError().text());
            return false;
        }
    }

    if (savedNote)
        *savedNote = { securityId, contentHtml, updatedAt };
    if (errorMessage)
        errorMessage->clear();
    return true;
}
