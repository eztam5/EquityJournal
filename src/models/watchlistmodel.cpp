#include "watchlistmodel.h"

#include <algorithm>

WatchlistModel::WatchlistModel(WatchlistRepository &repository, QObject *parent)
    : QAbstractListModel(parent)
    , m_repository(repository)
{
    m_watchlists = repository.all(&m_lastError);
}

int WatchlistModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_watchlists.size();
}

QVariant WatchlistModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_watchlists.size())
        return {};

    const auto &watchlist = m_watchlists.at(index.row());
    switch (role) {
    case WatchlistIdRole:
        return watchlist.id;
    case NameRole:
    case Qt::DisplayRole:
        return watchlist.name;
    default:
        return {};
    }
}

QHash<int, QByteArray> WatchlistModel::roleNames() const
{
    return {
        { WatchlistIdRole, "watchlistId" },
        { NameRole, "name" }
    };
}

QString WatchlistModel::lastError() const
{
    return m_lastError;
}

bool WatchlistModel::addWatchlist(const QString &name)
{
    const QString normalizedName = name.trimmed();
    if (normalizedName.isEmpty()) {
        setLastError(tr("Enter a watchlist name."));
        return false;
    }

    WatchlistRecord watchlist;
    QString repositoryError;
    if (!m_repository.add(normalizedName, &watchlist, &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    const auto position = std::lower_bound(
        m_watchlists.cbegin(), m_watchlists.cend(), watchlist,
        [](const WatchlistRecord &left, const WatchlistRecord &right) {
            const int nameComparison = left.name.compare(right.name, Qt::CaseInsensitive);
            return nameComparison != 0 ? nameComparison < 0 : left.id < right.id;
        });
    const int row = static_cast<int>(std::distance(m_watchlists.cbegin(), position));

    beginInsertRows({}, row, row);
    m_watchlists.insert(row, watchlist);
    endInsertRows();

    setLastError({});
    return true;
}

void WatchlistModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;

    m_lastError = message;
    emit lastErrorChanged();
}
