#pragma once

#include "../repositories/securitynoterepository.h"

#include <QObject>
#include <QString>

class QQuickTextDocument;

class SecurityNoteModel final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString contentHtml READ contentHtml NOTIFY contentHtmlChanged)
    Q_PROPERTY(QString updatedAt READ updatedAt NOTIFY updatedAtChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)

public:
    explicit SecurityNoteModel(SecurityNoteRepository &repository,
                               QObject *parent = nullptr);

    QString contentHtml() const;
    QString updatedAt() const;
    QString lastError() const;

    Q_INVOKABLE bool loadSecurity(const QString &securityId);
    Q_INVOKABLE bool saveDocument(const QString &securityId, QObject *textDocument);
    Q_INVOKABLE void toggleBold(QObject *textDocument, int start, int end);
    Q_INVOKABLE void toggleItalic(QObject *textDocument, int start, int end);
    Q_INVOKABLE void toggleUnderline(QObject *textDocument, int start, int end);
    Q_INVOKABLE void toggleStrikethrough(QObject *textDocument, int start, int end);
    Q_INVOKABLE void setParagraphStyle(QObject *textDocument,
                                       int start,
                                       int end,
                                       int headingLevel);
    Q_INVOKABLE void toggleBulletList(QObject *textDocument, int start, int end);
    Q_INVOKABLE void toggleNumberedList(QObject *textDocument, int start, int end);
    Q_INVOKABLE void changeIndent(QObject *textDocument, int start, int end, int delta);
    Q_INVOKABLE void setTextColor(QObject *textDocument,
                                  int start,
                                  int end,
                                  const QString &color);
    Q_INVOKABLE void setBackgroundColor(QObject *textDocument,
                                        int start,
                                        int end,
                                        const QString &color);
    Q_INVOKABLE void insertLink(QObject *textDocument,
                                int start,
                                int end,
                                const QString &url,
                                const QString &label);
    Q_INVOKABLE void insertTable(QObject *textDocument,
                                 int position,
                                 int rows,
                                 int columns);
    Q_INVOKABLE bool isPositionInTable(QObject *textDocument, int position) const;
    Q_INVOKABLE void insertTableRow(QObject *textDocument,
                                    int position,
                                    bool before);
    Q_INVOKABLE void deleteTableRow(QObject *textDocument, int position);
    Q_INVOKABLE void insertTableColumn(QObject *textDocument,
                                       int position,
                                       bool before);
    Q_INVOKABLE void deleteTableColumn(QObject *textDocument, int position);
    Q_INVOKABLE void deleteTable(QObject *textDocument, int position);

signals:
    void contentHtmlChanged();
    void updatedAtChanged();
    void lastErrorChanged();

private:
    QQuickTextDocument *documentFrom(QObject *object) const;
    void toggleList(QObject *textDocument,
                    int start,
                    int end,
                    int listStyle);
    void setLastError(const QString &message);

    SecurityNoteRepository &m_repository;
    QString m_contentHtml;
    QString m_updatedAt;
    QString m_lastError;
};
