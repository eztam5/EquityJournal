#pragma once

#include "securitynoterepository.h"

class SqlSecurityNoteRepository final : public SecurityNoteRepository
{
public:
    explicit SqlSecurityNoteRepository(QString connectionName);

    SecurityNoteRecord find(const QString &securityId,
                            QString *errorMessage = nullptr) const override;
    bool save(const QString &securityId,
              const QString &contentHtml,
              SecurityNoteRecord *savedNote,
              QString *errorMessage = nullptr) override;

private:
    QString m_connectionName;
};
