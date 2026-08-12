#pragma once

#include "watchlistrepository.h"

class SqlWatchlistRepository final : public WatchlistRepository
{
public:
    explicit SqlWatchlistRepository(QString connectionName);

    QVector<WatchlistRecord> all(QString *errorMessage = nullptr) const override;
    bool add(const QString &name,
             WatchlistRecord *createdWatchlist,
             QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
