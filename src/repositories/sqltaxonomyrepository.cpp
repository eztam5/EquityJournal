#include "sqltaxonomyrepository.h"

#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>

#include <utility>

SqlTaxonomyRepository::SqlTaxonomyRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

QVector<TaxonomyRecord> SqlTaxonomyRepository::all(QString *errorMessage) const
{
    QVector<TaxonomyRecord> taxonomies;
    auto database = QSqlDatabase::database(m_connectionName);
    QSqlQuery query(database);

    if (!query.exec(QStringLiteral(
            "SELECT id, name, description, color, sort_order "
            "FROM taxonomies "
            "WHERE archived_at IS NULL "
            "ORDER BY sort_order, lower(name), id"))) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load taxonomies: %1")
                                .arg(query.lastError().text());
        return taxonomies;
    }

    while (query.next()) {
        taxonomies.append({
            query.value(0).toString(),
            query.value(1).toString(),
            query.value(2).toString(),
            query.value(3).toString(),
            query.value(4).toInt()
        });
    }

    if (errorMessage)
        errorMessage->clear();
    return taxonomies;
}

bool SqlTaxonomyRepository::add(const QString &name,
                                const QString &description,
                                const QString &color,
                                TaxonomyRecord *createdTaxonomy,
                                QString *errorMessage)
{
    const QString normalizedName = name.trimmed();
    const QString normalizedDescription = description.trimmed();
    const QString normalizedColor = color.trimmed().toUpper();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery duplicateCheck(database);
    duplicateCheck.prepare(QStringLiteral(
        "SELECT 1 FROM taxonomies WHERE lower(name) = lower(:name)"));
    duplicateCheck.bindValue(QStringLiteral(":name"), normalizedName);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the taxonomy name: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("A taxonomy with this name already exists.");
        return false;
    }

    QSqlQuery orderQuery(database);
    if (!orderQuery.exec(QStringLiteral(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM taxonomies"))
        || !orderQuery.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not determine the taxonomy order: %1")
                                .arg(orderQuery.lastError().text());
        return false;
    }

    TaxonomyRecord taxonomy {
        QUuid::createUuid().toString(QUuid::WithoutBraces),
        normalizedName,
        normalizedDescription,
        normalizedColor,
        orderQuery.value(0).toInt()
    };

    QSqlQuery insert(database);
    insert.prepare(QStringLiteral(
        "INSERT INTO taxonomies (id, name, description, color, sort_order) "
        "VALUES (:id, :name, :description, :color, :sort_order)"));
    insert.bindValue(QStringLiteral(":id"), taxonomy.id);
    insert.bindValue(QStringLiteral(":name"), taxonomy.name);
    insert.bindValue(QStringLiteral(":description"), taxonomy.description);
    insert.bindValue(QStringLiteral(":color"), taxonomy.color);
    insert.bindValue(QStringLiteral(":sort_order"), taxonomy.sortOrder);
    if (!insert.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not save the taxonomy: %1")
                                .arg(insert.lastError().text());
        return false;
    }

    if (createdTaxonomy)
        *createdTaxonomy = taxonomy;
    if (errorMessage)
        errorMessage->clear();
    return true;
}
