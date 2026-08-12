#include "sqlwatchlistrepository.h"

#include <QSqlDatabase>
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>

#include <utility>

SqlWatchlistRepository::SqlWatchlistRepository(QString connectionName)
    : m_connectionName(std::move(connectionName))
{
}

QVector<WatchlistRecord> SqlWatchlistRepository::all(QString *errorMessage) const
{
    QVector<WatchlistRecord> watchlists;
    auto database = QSqlDatabase::database(m_connectionName);
    QSqlQuery query(database);

    if (!query.exec(QStringLiteral(
            "SELECT id, name FROM watchlists ORDER BY lower(name), id"))) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not load watchlists: %1")
                                .arg(query.lastError().text());
        return watchlists;
    }

    while (query.next()) {
        watchlists.append({
            query.value(0).toString(),
            query.value(1).toString()
        });
    }

    if (errorMessage)
        errorMessage->clear();
    return watchlists;
}

bool SqlWatchlistRepository::add(const QString &name,
                                 WatchlistRecord *createdWatchlist,
                                 QString *errorMessage)
{
    const QString normalizedName = name.trimmed();
    auto database = QSqlDatabase::database(m_connectionName);

    QSqlQuery duplicateCheck(database);
    duplicateCheck.prepare(QStringLiteral(
        "SELECT 1 FROM watchlists WHERE lower(name) = lower(:name)"));
    duplicateCheck.bindValue(QStringLiteral(":name"), normalizedName);
    if (!duplicateCheck.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not validate the watchlist name: %1")
                                .arg(duplicateCheck.lastError().text());
        return false;
    }
    if (duplicateCheck.next()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("A watchlist with this name already exists.");
        return false;
    }

    WatchlistRecord watchlist {
        QUuid::createUuid().toString(QUuid::WithoutBraces),
        normalizedName
    };

    QSqlQuery insert(database);
    insert.prepare(QStringLiteral(
        "INSERT INTO watchlists (id, name) VALUES (:id, :name)"));
    insert.bindValue(QStringLiteral(":id"), watchlist.id);
    insert.bindValue(QStringLiteral(":name"), watchlist.name);
    if (!insert.exec()) {
        if (errorMessage)
            *errorMessage = QStringLiteral("Could not save the watchlist: %1")
                                .arg(insert.lastError().text());
        return false;
    }

    if (createdWatchlist)
        *createdWatchlist = watchlist;
    if (errorMessage)
        errorMessage->clear();
    return true;
}
