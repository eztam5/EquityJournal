#pragma once

#include <QString>
#include <QVector>

struct TagRecord
{
    QString id;
    QString taxonomyId;
    QString parentId;
    QString name;
    QString description;
    QString color;
    int sortOrder = 0;
};

class TagRepository
{
public:
    virtual ~TagRepository() = default;

    virtual QVector<TagRecord> allForTaxonomy(
        const QString &taxonomyId,
        QString *errorMessage = nullptr) const = 0;
    virtual bool add(const QString &taxonomyId,
                     const QString &parentId,
                     const QString &name,
                     const QString &description,
                     const QString &color,
                     TagRecord *createdTag,
                     QString *errorMessage = nullptr) = 0;
    virtual bool update(const QString &taxonomyId,
                        const QString &tagId,
                        const QString &name,
                        const QString &description,
                        const QString &color,
                        QString *errorMessage = nullptr) = 0;
    virtual bool remove(const QString &taxonomyId,
                        const QString &tagId,
                        QString *errorMessage = nullptr) = 0;
};
