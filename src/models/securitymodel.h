#pragma once

#include "../repositories/securityrepository.h"

#include <QAbstractTableModel>
#include <QString>
#include <QVariantMap>
#include <QVector>

class SecurityModel : public QAbstractTableModel
{
    Q_OBJECT
    Q_PROPERTY(int count READ count NOTIFY countChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    enum Column {
        SymbolColumn,
        NameColumn,
        CurrencyColumn,
        ColumnCount
    };
    Q_ENUM(Column)

    explicit SecurityModel(SecurityRepository &repository, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    int columnCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QVariant headerData(int section,
                        Qt::Orientation orientation,
                        int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    int count() const;
    QString lastError() const;
    Q_INVOKABLE bool addSecurity(const QString &symbol,
                                 const QString &currency,
                                 const QString &companyName);
    Q_INVOKABLE QVariantMap securityAt(int row) const;
    Q_INVOKABLE bool updateSecurity(const QString &id,
                                    const QString &symbol,
                                    const QString &currency,
                                    const QString &companyName);
    Q_INVOKABLE bool deleteSecurity(const QString &id);

signals:
    void countChanged();
    void lastErrorChanged();

private:
    void setLastError(const QString &message);

    SecurityRepository &m_repository;
    QVector<SecurityRecord> m_securities;
    QString m_lastError;
};
