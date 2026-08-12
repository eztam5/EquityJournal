#include "sqltagrepository.h"

#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>
#include <QVariant>

#include <utility>

SqlTagRepository::SqlTagRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

QVector<TagRecord> SqlTagRepository::allForTaxonomy(
    const QString &taxonomyId,
    QString *errorMessage) const
{
    QVector<TagRecord> tags;
    QSqlQuery query(QSqlDatabase::database(m_connectionName));
    query.prepare(QStringLiteral(
        "SELECT id, taxonomy_id, parent_id, name, description, color, sort_order "
        "FROM tags "
        "WHERE taxonomy_id = :taxonomy_id AND archived_at IS NULL "
        "ORDER BY sort_order, lower(name), id"));
    query.bindValue(QStringLiteral(":taxonomy_id"), taxonomyId);

    if (!query.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load tags: %1")
                                .arg(query.lastError().text());
        return tags;
    }

    while (query.next()) {
        tags.append({
            query.value(0).toString(),
            query.value(1).toString(),
            query.value(2).toString(),
            query.value(3).toString(),
            query.value(4).toString(),
            query.value(5).toString(),
            query.value(6).toInt()
        });
    }

    if (errorMessage)
        errorMessage->clear();
    return tags;
}

bool SqlTagRepository::add(const QString &taxonomyId,
                           const QString &parentId,
                           const QString &name,
                           const QString &description,
                           const QString &color,
                           TagRecord *createdTag,
                           QString *errorMessage)
{
    const QString normalizedTaxonomyId = taxonomyId.trimmed();
    const QString normalizedParentId = parentId.trimmed();
    const QString normalizedName = name.trimmed();
    const QString normalizedDescription = description.trimmed();
    const QString normalizedColor = color.trimmed().toUpper();
    auto database = QSqlDatabase::database(m_connectionName);

    if (!normalizedParentId.isEmpty()) {
        QSqlQuery parentCheck(database);
        parentCheck.prepare(QStringLiteral(
            "SELECT 1 FROM tags "
            "WHERE id = :parent_id AND taxonomy_id = :taxonomy_id "
            "AND archived_at IS NULL"));
        parentCheck.bindValue(QStringLiteral(":parent_id"), normalizedParentId);
        parentCheck.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
        if (!parentCheck.exec()) {
            if (errorMessage)
                *errorMessage = QStringLiteral("Could not validate the parent tag: %1")
                                    .arg(parentCheck.lastError().text());
            return false;
        }
        if (!parentCheck.next()) {
            if (errorMessage)
                *errorMessage = QStringLiteral(
                    "The selected parent tag does not belong to this taxonomy.");
            return false;
        }
    }

    QSqlQuery duplicateCheck(database);
    if (normalizedParentId.isEmpty()) {
        duplicateCheck.prepare(QStringLiteral(
            "SELECT 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id IS NULL "
            "AND lower(name) = lower(:name) AND archived_at IS NULL"));
    } else {
        duplicateCheck.prepare(QStringLiteral(
            "SELECT 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id = :parent_id "
            "AND lower(name) = lower(:name) AND archived_at IS NULL"));
        duplicateCheck.bindValue(QStringLiteral(":parent_id"), normalizedParentId);
    }
    duplicateCheck.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    duplicateCheck.bindValue(QStringLiteral(":name"), normalizedName);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the tag name: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral(
                "A tag with this name already exists under the selected parent.");
        return false;
    }

    QSqlQuery orderQuery(database);
    if (normalizedParentId.isEmpty()) {
        orderQuery.prepare(QStringLiteral(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id IS NULL"));
    } else {
        orderQuery.prepare(QStringLiteral(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id = :parent_id"));
        orderQuery.bindValue(QStringLiteral(":parent_id"), normalizedParentId);
    }
    orderQuery.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    if (!orderQuery.exec() || !orderQuery.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not determine the tag order: %1")
                                .arg(orderQuery.lastError().text());
        return false;
    }

    TagRecord tag {
        QUuid::createUuid().toString(QUuid::WithoutBraces),
        normalizedTaxonomyId,
        normalizedParentId,
        normalizedName,
        normalizedDescription,
        normalizedColor,
        orderQuery.value(0).toInt()
    };

    QSqlQuery insert(database);
    insert.prepare(QStringLiteral(
        "INSERT INTO tags "
        "(id, taxonomy_id, parent_id, name, description, color, sort_order) "
        "VALUES (:id, :taxonomy_id, :parent_id, :name, :description, :color, :sort_order)"));
    insert.bindValue(QStringLiteral(":id"), tag.id);
    insert.bindValue(QStringLiteral(":taxonomy_id"), tag.taxonomyId);
    insert.bindValue(QStringLiteral(":parent_id"),
                     tag.parentId.isEmpty() ? QVariant() : QVariant(tag.parentId));
    insert.bindValue(QStringLiteral(":name"), tag.name);
    insert.bindValue(QStringLiteral(":description"), tag.description);
    insert.bindValue(QStringLiteral(":color"), tag.color);
    insert.bindValue(QStringLiteral(":sort_order"), tag.sortOrder);
    if (!insert.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not save the tag: %1")
                                .arg(insert.lastError().text());
        return false;
    }

    if (createdTag)
        *createdTag = tag;
    if (errorMessage)
        errorMessage->clear();
    return true;
}

bool SqlTagRepository::update(const QString &taxonomyId,
                              const QString &tagId,
                              const QString &name,
                              const QString &description,
                              const QString &color,
                              QString *errorMessage)
{
    const QString normalizedTaxonomyId = taxonomyId.trimmed();
    const QString normalizedTagId = tagId.trimmed();
    const QString normalizedName = name.trimmed();
    const QString normalizedDescription = description.trimmed();
    const QString normalizedColor = color.trimmed().toUpper();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery tagQuery(database);
    tagQuery.prepare(QStringLiteral(
        "SELECT parent_id FROM tags "
        "WHERE id = :tag_id AND taxonomy_id = :taxonomy_id "
        "AND archived_at IS NULL"));
    tagQuery.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    tagQuery.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    if (!tagQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load the tag: %1")
                                .arg(tagQuery.lastError().text());
        return false;
    }
    if (!tagQuery.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("The tag no longer exists.");
        return false;
    }
    const QString parentId = tagQuery.value(0).toString();

    QSqlQuery duplicateCheck(database);
    if (parentId.isEmpty()) {
        duplicateCheck.prepare(QStringLiteral(
            "SELECT 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id IS NULL "
            "AND id <> :tag_id AND lower(name) = lower(:name) "
            "AND archived_at IS NULL"));
    } else {
        duplicateCheck.prepare(QStringLiteral(
            "SELECT 1 FROM tags "
            "WHERE taxonomy_id = :taxonomy_id AND parent_id = :parent_id "
            "AND id <> :tag_id AND lower(name) = lower(:name) "
            "AND archived_at IS NULL"));
        duplicateCheck.bindValue(QStringLiteral(":parent_id"), parentId);
    }
    duplicateCheck.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    duplicateCheck.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    duplicateCheck.bindValue(QStringLiteral(":name"), normalizedName);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the tag name: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral(
                "A tag with this name already exists under the same parent.");
        return false;
    }

    QSqlQuery updateQuery(database);
    updateQuery.prepare(QStringLiteral(
        "UPDATE tags SET name = :name, description = :description, color = :color "
        "WHERE id = :tag_id AND taxonomy_id = :taxonomy_id "
        "AND archived_at IS NULL"));
    updateQuery.bindValue(QStringLiteral(":name"), normalizedName);
    updateQuery.bindValue(QStringLiteral(":description"), normalizedDescription);
    updateQuery.bindValue(QStringLiteral(":color"), normalizedColor);
    updateQuery.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    updateQuery.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    if (!updateQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not update the tag: %1")
                                .arg(updateQuery.lastError().text());
        return false;
    }

    if (errorMessage)
        errorMessage->clear();
    return true;
}

bool SqlTagRepository::remove(const QString &taxonomyId,
                              const QString &tagId,
                              QString *errorMessage)
{
    const QString normalizedTaxonomyId = taxonomyId.trimmed();
    const QString normalizedTagId = tagId.trimmed();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery tagCheck(database);
    tagCheck.prepare(QStringLiteral(
        "SELECT 1 FROM tags "
        "WHERE id = :tag_id AND taxonomy_id = :taxonomy_id "
        "AND archived_at IS NULL"));
    tagCheck.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    tagCheck.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    if (!tagCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the tag: %1")
                                .arg(tagCheck.lastError().text());
        return false;
    }
    if (!tagCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("The tag no longer exists.");
        return false;
    }

    QSqlQuery childCheck(database);
    childCheck.prepare(QStringLiteral(
        "SELECT 1 FROM tags WHERE parent_id = :tag_id AND archived_at IS NULL"));
    childCheck.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    if (!childCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not check for child tags: %1")
                                .arg(childCheck.lastError().text());
        return false;
    }
    if (childCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral(
                "This tag still contains child tags. Delete those first.");
        return false;
    }

    QSqlQuery deleteQuery(database);
    deleteQuery.prepare(QStringLiteral(
        "DELETE FROM tags WHERE id = :tag_id AND taxonomy_id = :taxonomy_id"));
    deleteQuery.bindValue(QStringLiteral(":tag_id"), normalizedTagId);
    deleteQuery.bindValue(QStringLiteral(":taxonomy_id"), normalizedTaxonomyId);
    if (!deleteQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not delete the tag: %1")
                                .arg(deleteQuery.lastError().text());
        return false;
    }

    if (errorMessage)
        errorMessage->clear();
    return true;
}
