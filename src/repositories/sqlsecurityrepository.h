#pragma once

#include "securityrepository.h"

class SqlSecurityRepository final : public SecurityRepository
{
public:
    explicit SqlSecurityRepository(QString connectionName);

    QVector<SecurityRecord> all(QString *errorMessage = nullptr) const override;
    bool add(const QString &symbol,
             const QString &currency,
             const QString &companyName,
             SecurityRecord *createdSecurity,
             QString *errorMessage = nullptr) override;
    bool update(const QString &id,
                const QString &symbol,
                const QString &currency,
                const QString &companyName,
                SecurityRecord *updatedSecurity,
                QString *errorMessage = nullptr) override;
    bool remove(const QString &id, QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
