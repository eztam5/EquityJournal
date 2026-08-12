#pragma once

#include "../repositories/watchlistrepository.h"

#include <QAbstractListModel>
#include <QString>
#include <QVector>

class WatchlistModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    enum Role {
        WatchlistIdRole = Qt::UserRole + 1,
        NameRole
    };
    Q_ENUM(Role)

    explicit WatchlistModel(WatchlistRepository &repository, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString lastError() const;
    Q_INVOKABLE bool addWatchlist(const QString &name);

signals:
    void lastErrorChanged();

private:
    void setLastError(const QString &message);

    WatchlistRepository &m_repository;
    QVector<WatchlistRecord> m_watchlists;
    QString m_lastError;
};
