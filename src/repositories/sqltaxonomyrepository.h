#pragma once

#include "taxonomyrepository.h"

class SqlTaxonomyRepository final : public TaxonomyRepository
{
public:
    explicit SqlTaxonomyRepository(QString connectionName);

    QVector<TaxonomyRecord> all(QString *errorMessage = nullptr) const override;
    bool add(const QString &name,
             const QString &description,
             const QString &color,
             TaxonomyRecord *createdTaxonomy,
             QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
