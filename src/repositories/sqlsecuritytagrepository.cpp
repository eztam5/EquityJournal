#include "sqlsecuritytagrepository.h"

#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>

#include <utility>

SqlSecurityTagRepository::SqlSecurityTagRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

SecurityTagAssignmentData SqlSecurityTagRepository::load(
    const QString &securityId,
    QString *errorMessage) const
{
    SecurityTagAssignmentData data;
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery taxonomyQuery(database);
    if (!taxonomyQuery.exec(QStringLiteral(
            "SELECT id, name, color, sort_order FROM taxonomies "
            "WHERE archived_at IS NULL ORDER BY sort_order, lower(name), id"))) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load taxonomies: %1")
                                .arg(taxonomyQuery.lastError().text());
        return data;
    }

    while (taxonomyQuery.next()) {
        AssignableTaxonomyRecord taxonomy {
            taxonomyQuery.value(0).toString(),
            taxonomyQuery.value(1).toString(),
            taxonomyQuery.value(2).toString(),
            taxonomyQuery.value(3).toInt(),
            {}
        };

        QSqlQuery tagQuery(database);
        tagQuery.prepare(QStringLiteral(
            "SELECT id, parent_id, name, description, color, sort_order FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND archived_at IS NULL "
            "ORDER BY sort_order, lower(name), id"));
        tagQuery.bindValue(QStringLiteral(":taxonomy_id"), taxonomy.id);
        if (!tagQuery.exec()) {
            if (errorMessage)
                *errorMessage = QStringLiteral("Could not load tags: %1")
                                    .arg(tagQuery.lastError().text());
            return {};
        }
        while (tagQuery.next()) {
            taxonomy.tags.append({
                tagQuery.value(0).toString(),
                tagQuery.value(1).toString(),
                tagQuery.value(2).toString(),
                tagQuery.value(3).toString(),
                tagQuery.value(4).toString(),
                tagQuery.value(5).toInt()
            });
        }
        data.taxonomies.append(std::move(taxonomy));
    }

    QSqlQuery assignmentQuery(database);
    assignmentQuery.prepare(QStringLiteral(
        "SELECT st.tag_id FROM security_tags st "
        "JOIN tags t ON t.id = st.tag_id "
        "WHERE st.security_id = :security_id AND t.archived_at IS NULL"));
    assignmentQuery.bindValue(QStringLiteral(":security_id"), securityId);
    if (!assignmentQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load tag assignments: %1")
                                .arg(assignmentQuery.lastError().text());
        return {};
    }
    while (assignmentQuery.next())
        data.assignedTagIds.insert(assignmentQuery.value(0).toString());

    if (errorMessage)
        errorMessage->clear();
    return data;
}

bool SqlSecurityTagRepository::replace(const QString &securityId,
                                       const QSet<QString> &tagIds,
                                       QString *errorMessage)
{
    auto database = QSqlDatabase::database(m_connectionName);
    if (!database.transaction()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not start saving tag assignments: %1")
                                .arg(database.lastError().text());
        return false;
    }

    QSqlQuery deleteQuery(database);
    deleteQuery.prepare(QStringLiteral(
        "DELETE FROM security_tags WHERE security_id = :security_id"));
    deleteQuery.bindValue(QStringLiteral(":security_id"), securityId);
    if (!deleteQuery.exec()) {
        database.rollback();
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not replace tag assignments: %1")
                                .arg(deleteQuery.lastError().text());
        return false;
    }

    for (const auto &tagId : tagIds) {
        QSqlQuery insertQuery(database);
        insertQuery.prepare(QStringLiteral(
            "INSERT INTO security_tags (security_id, tag_id) "
            "VALUES (:security_id, :tag_id)"));
        insertQuery.bindValue(QStringLiteral(":security_id"), securityId);
        insertQuery.bindValue(QStringLiteral(":tag_id"), tagId);
        if (!insertQuery.exec()) {
            database.rollback();
            if (errorMessage)
                *errorMessage = QStringLiteral("Could not save tag assignments: %1")
                                    .arg(insertQuery.lastError().text());
            return false;
        }
    }

    if (!database.commit()) {
        database.rollback();
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not commit tag assignments: %1")
                                .arg(database.lastError().text());
        return false;
    }

    if (errorMessage)
        errorMessage->clear();
    return true;
}
