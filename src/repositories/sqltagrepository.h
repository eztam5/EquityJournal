#pragma once

#include "tagrepository.h"

class SqlTagRepository final : public TagRepository
{
public:
    explicit SqlTagRepository(QString connectionName);

    QVector<TagRecord> allForTaxonomy(
        const QString &taxonomyId,
        QString *errorMessage = nullptr) const override;
    bool add(const QString &taxonomyId,
             const QString &parentId,
             const QString &name,
             const QString &description,
             const QString &color,
             TagRecord *createdTag,
             QString *errorMessage = nullptr) override;
    bool update(const QString &taxonomyId,
                const QString &tagId,
                const QString &name,
                const QString &description,
                const QString &color,
                QString *errorMessage = nullptr) override;
    bool remove(const QString &taxonomyId,
                const QString &tagId,
                QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
