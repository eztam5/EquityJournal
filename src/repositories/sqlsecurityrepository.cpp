#include "sqlsecurityrepository.h"

#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>

#include <utility>

SqlSecurityRepository::SqlSecurityRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

QVector<SecurityRecord> SqlSecurityRepository::all(QString *errorMessage) const
{
    QVector<SecurityRecord> securities;
    auto database = QSqlDatabase::database(m_connectionName);
    QSqlQuery query(database);

    if (!query.exec(QStringLiteral(
            "SELECT id, name, symbol, currency "
            "FROM securities ORDER BY lower(symbol), id"))) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load securities: %1")
                                .arg(query.lastError().text());
        return securities;
    }

    while (query.next()) {
        securities.append({
            query.value(0).toString(),
            query.value(1).toString(),
            query.value(2).toString(),
            query.value(3).toString()
        });
    }

    if (errorMessage)
        errorMessage->clear();
    return securities;
}

bool SqlSecurityRepository::add(const QString &symbol,
                                const QString &currency,
                                const QString &companyName,
                                SecurityRecord *createdSecurity,
                                QString *errorMessage)
{
    const QString normalizedSymbol = symbol.trimmed().toUpper();
    const QString normalizedCurrency = currency.trimmed().toUpper();
    const QString normalizedName = companyName.trimmed();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery duplicateCheck(database);
    duplicateCheck.prepare(QStringLiteral(
        "SELECT 1 FROM securities WHERE lower(symbol) = lower(:symbol)"));
    duplicateCheck.bindValue(QStringLiteral(":symbol"), normalizedSymbol);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the security symbol: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("A security with this symbol already exists.");
        return false;
    }

    SecurityRecord security {
        QUuid::createUuid().toString(QUuid::WithoutBraces),
        normalizedName,
        normalizedSymbol,
        normalizedCurrency
    };

    QSqlQuery insert(database);
    insert.prepare(QStringLiteral(
        "INSERT INTO securities (id, name, symbol, currency) "
        "VALUES (:id, :name, :symbol, :currency)"));
    insert.bindValue(QStringLiteral(":id"), security.id);
    insert.bindValue(QStringLiteral(":name"), security.name);
    insert.bindValue(QStringLiteral(":symbol"), security.symbol);
    insert.bindValue(QStringLiteral(":currency"), security.currency);
    if (!insert.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not save the security: %1")
                                .arg(insert.lastError().text());
        return false;
    }

    if (createdSecurity)
        *createdSecurity = security;
    if (errorMessage)
        errorMessage->clear();
    return true;
}

bool SqlSecurityRepository::update(const QString &id,
                                   const QString &symbol,
                                   const QString &currency,
                                   const QString &companyName,
                                   SecurityRecord *updatedSecurity,
                                   QString *errorMessage)
{
    const QString normalizedSymbol = symbol.trimmed().toUpper();
    const QString normalizedCurrency = currency.trimmed().toUpper();
    const QString normalizedName = companyName.trimmed();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery duplicateCheck(database);
    duplicateCheck.prepare(QStringLiteral(
        "SELECT 1 FROM securities "
        "WHERE lower(symbol) = lower(:symbol) AND id <> :id"));
    duplicateCheck.bindValue(QStringLiteral(":symbol"), normalizedSymbol);
    duplicateCheck.bindValue(QStringLiteral(":id"), id);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the security symbol: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("A security with this symbol already exists.");
        return false;
    }

    QSqlQuery updateQuery(database);
    updateQuery.prepare(QStringLiteral(
        "UPDATE securities "
        "SET name = :name, symbol = :symbol, currency = :currency "
        "WHERE id = :id"));
    updateQuery.bindValue(QStringLiteral(":name"), normalizedName);
    updateQuery.bindValue(QStringLiteral(":symbol"), normalizedSymbol);
    updateQuery.bindValue(QStringLiteral(":currency"), normalizedCurrency);
    updateQuery.bindValue(QStringLiteral(":id"), id);
    if (!updateQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not update the security: %1")
                                .arg(updateQuery.lastError().text());
        return false;
    }
    if (updateQuery.numRowsAffected() != 1) {
        if (errorMessage)
            *errorMessage = QStringLiteral("The security no longer exists.");
        return false;
    }

    if (updatedSecurity) {
        *updatedSecurity = {
            id,
            normalizedName,
            normalizedSymbol,
            normalizedCurrency
        };
    }
    if (errorMessage)
        errorMessage->clear();
    return true;
}

bool SqlSecurityRepository::remove(const QString &id, QString *errorMessage)
{
    auto database = QSqlDatabase::database(m_connectionName);
    QSqlQuery deleteQuery(database);
    deleteQuery.prepare(QStringLiteral("DELETE FROM securities WHERE id = :id"));
    deleteQuery.bindValue(QStringLiteral(":id"), id);

    if (!deleteQuery.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not delete the security: %1")
                                .arg(deleteQuery.lastError().text());
        return false;
    }
    if (deleteQuery.numRowsAffected() != 1) {
        if (errorMessage)
            *errorMessage = QStringLiteral("The security no longer exists.");
        return false;
    }

    if (errorMessage)
        errorMessage->clear();
    return true;
}
