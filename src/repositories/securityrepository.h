#pragma once

#include <QString>
#include <QVector>

struct SecurityRecord
{
    QString id;
    QString name;
    QString symbol;
    QString currency;
};

class SecurityRepository
{
public:
    virtual ~SecurityRepository() = default;

    virtual QVector<SecurityRecord> all(QString *errorMessage = nullptr) const = 0;
    virtual bool add(const QString &symbol,
                     const QString &currency,
                     const QString &companyName,
                     SecurityRecord *createdSecurity,
                     QString *errorMessage = nullptr) = 0;
    virtual bool update(const QString &id,
                        const QString &symbol,
                        const QString &currency,
                        const QString &companyName,
                        SecurityRecord *updatedSecurity,
                        QString *errorMessage = nullptr) = 0;
    virtual bool remove(const QString &id, QString *errorMessage = nullptr) = 0;
};
