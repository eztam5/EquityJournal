#pragma once

#include "../repositories/securityrepository.h"

#include <QAbstractListModel>
#include <QSettings>
#include <QStringList>
#include <QVector>

class SecurityModel;

class RecentSecuritiesModel final : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)

public:
    enum Role {
        SecurityIdRole = Qt::UserRole + 1,
        NameRole,
        SymbolRole,
        CurrencyRole
    };
    Q_ENUM(Role)

    explicit RecentSecuritiesModel(SecurityModel &securityModel,
                                   QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    int count() const;
    Q_INVOKABLE bool recordView(const QString &securityId);

signals:
    void countChanged();

private slots:
    void handleSecurityUpdated(const QString &securityId);
    void handleSecurityDeleted(const QString &securityId);

private:
    void load();
    void save();
    int indexOf(const QString &securityId) const;

    SecurityModel &m_securityModel;
    QSettings m_settings;
    QVector<SecurityRecord> m_securities;
};
