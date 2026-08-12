#pragma once

#include "../repositories/taxonomyrepository.h"

#include <QAbstractListModel>
#include <QString>
#include <QVector>

class TaxonomyModel : public QAbstractListModel
{
    Q_OBJECT
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    enum Role {
        TaxonomyIdRole = Qt::UserRole + 1,
        NameRole,
        DescriptionRole,
        ColorRole
    };
    Q_ENUM(Role)

    explicit TaxonomyModel(TaxonomyRepository &repository, QObject *parent = nullptr);

    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString lastError() const;
    Q_INVOKABLE bool addTaxonomy(const QString &name,
                                 const QString &description,
                                 const QString &color);

signals:
    void lastErrorChanged();

private:
    void setLastError(const QString &message);

    TaxonomyRepository &m_repository;
    QVector<TaxonomyRecord> m_taxonomies;
    QString m_lastError;
};
