#pragma once

#include <QString>

struct SecurityNoteRecord
{
    QString securityId;
    QString contentHtml;
    QString updatedAt;
};

class SecurityNoteRepository
{
public:
    virtual ~SecurityNoteRepository() = default;

    virtual SecurityNoteRecord find(const QString &securityId,
                                    QString *errorMessage = nullptr) const = 0;
    virtual bool save(const QString &securityId,
                      const QString &contentHtml,
                      SecurityNoteRecord *savedNote,
                      QString *errorMessage = nullptr) = 0;
};
