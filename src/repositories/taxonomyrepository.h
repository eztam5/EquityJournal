#pragma once

#include <QString>
#include <QVector>

struct TaxonomyRecord
{
    QString id;
    QString name;
    QString description;
    QString color;
    int sortOrder = 0;
};

class TaxonomyRepository
{
public:
    virtual ~TaxonomyRepository() = default;

    virtual QVector<TaxonomyRecord> all(QString *errorMessage = nullptr) const = 0;
    virtual bool add(const QString &name,
                     const QString &description,
                     const QString &color,
                     TaxonomyRecord *createdTaxonomy,
                     QString *errorMessage = nullptr) = 0;
};
