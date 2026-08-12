#pragma once

#include <QString>
#include <QVector>

struct WatchlistRecord
{
    QString id;
    QString name;
};

class WatchlistRepository
{
public:
    virtual ~WatchlistRepository() = default;

    virtual QVector<WatchlistRecord> all(QString *errorMessage = nullptr) const = 0;
    virtual bool add(const QString &name,
                     WatchlistRecord *createdWatchlist,
                     QString *errorMessage = nullptr) = 0;
};
