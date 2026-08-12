#pragma once

#include <QSet>
#include <QString>
#include <QVector>

struct AssignableTagRecord
{
    QString id;
    QString parentId;
    QString name;
    QString description;
    QString color;
    int sortOrder = 0;
};

struct AssignableTaxonomyRecord
{
    QString id;
    QString name;
    QString color;
    int sortOrder = 0;
    QVector<AssignableTagRecord> tags;
};

struct SecurityTagAssignmentData
{
    QVector<AssignableTaxonomyRecord> taxonomies;
    QSet<QString> assignedTagIds;
};

class SecurityTagRepository
{
public:
    virtual ~SecurityTagRepository() = default;

    virtual SecurityTagAssignmentData load(const QString &securityId,
                                           QString *errorMessage = nullptr) const = 0;
    virtual bool replace(const QString &securityId,
                         const QSet<QString> &tagIds,
                         QString *errorMessage = nullptr) = 0;
};
