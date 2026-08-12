#pragma once

#include "securitytagrepository.h"

class SqlSecurityTagRepository final : public SecurityTagRepository
{
public:
    explicit SqlSecurityTagRepository(QString connectionName);

    SecurityTagAssignmentData load(const QString &securityId,
                                   QString *errorMessage = nullptr) const override;
    bool replace(const QString &securityId,
                 const QSet<QString> &tagIds,
                 QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
