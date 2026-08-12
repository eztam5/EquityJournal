#include "securitynotemodel.h"

#include <QQuickTextDocument>
#include <QColor>
#include <QFont>
#include <QTextBlock>
#include <QTextBlockFormat>
#include <QTextCharFormat>
#include <QTextCursor>
#include <QTextDocument>
#include <QTextList>
#include <QTextListFormat>
#include <QTextTable>
#include <QTextTableFormat>
#include <QUrl>

#include <algorithm>

namespace {
QTextCursor selectionCursor(QTextDocument *document, int start, int end)
{
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(start, 0, document->characterCount() - 1));
    cursor.setPosition(std::clamp(end, 0, document->characterCount() - 1),
                       QTextCursor::KeepAnchor);
    return cursor;
}
}

SecurityNoteModel::SecurityNoteModel(SecurityNoteRepository &repository, QObject *parent)
    : QObject(parent)
    , m_repository(repository)
{
}

QString SecurityNoteModel::contentHtml() const { return m_contentHtml; }
QString SecurityNoteModel::updatedAt() const { return m_updatedAt; }
QString SecurityNoteModel::lastError() const { return m_lastError; }

bool SecurityNoteModel::loadSecurity(const QString &securityId)
{
    QString error;
    const auto note = m_repository.find(securityId, &error);
    if (!error.isEmpty()) {
        setLastError(error);
        return false;
    }

    if (m_contentHtml != note.contentHtml) {
        m_contentHtml = note.contentHtml;
        emit contentHtmlChanged();
    }
    if (m_updatedAt != note.updatedAt) {
        m_updatedAt = note.updatedAt;
        emit updatedAtChanged();
    }
    setLastError({});
    return true;
}

bool SecurityNoteModel::saveDocument(const QString &securityId, QObject *textDocument)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument || !quickDocument->textDocument()) {
        setLastError(tr("The note editor is not available."));
        return false;
    }

    const QString html = quickDocument->textDocument()->toHtml();
    SecurityNoteRecord savedNote;
    QString error;
    if (!m_repository.save(securityId, html, &savedNote, &error)) {
        setLastError(error);
        return false;
    }

    m_contentHtml = savedNote.contentHtml;
    if (m_updatedAt != savedNote.updatedAt) {
        m_updatedAt = savedNote.updatedAt;
        emit updatedAtChanged();
    }
    quickDocument->setModified(false);
    setLastError({});
    return true;
}

void SecurityNoteModel::toggleBold(QObject *textDocument, int start, int end)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    format.setFontWeight(cursor.charFormat().fontWeight() >= QFont::Bold
                             ? QFont::Normal : QFont::Bold);
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::toggleItalic(QObject *textDocument, int start, int end)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    format.setFontItalic(!cursor.charFormat().fontItalic());
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::toggleUnderline(QObject *textDocument, int start, int end)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    format.setFontUnderline(!cursor.charFormat().fontUnderline());
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::toggleStrikethrough(QObject *textDocument, int start, int end)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    format.setFontStrikeOut(!cursor.charFormat().fontStrikeOut());
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::setParagraphStyle(QObject *textDocument,
                                          int start,
                                          int end,
                                          int headingLevel)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    if (!cursor.hasSelection())
        cursor.select(QTextCursor::BlockUnderCursor);
    QTextBlockFormat format = cursor.blockFormat();
    const int level = std::clamp(headingLevel, 0, 2);
    if (level == 0)
        format.clearProperty(QTextFormat::HeadingLevel);
    else
        format.setHeadingLevel(level);
    cursor.setBlockFormat(format);

    QTextCharFormat characterFormat;
    if (level == 1) {
        characterFormat.setFontPointSize(22);
        characterFormat.setFontWeight(QFont::Bold);
    } else if (level == 2) {
        characterFormat.setFontPointSize(17);
        characterFormat.setFontWeight(QFont::DemiBold);
    } else {
        const QFont defaultFont = quickDocument->textDocument()->defaultFont();
        characterFormat.setFontPointSize(defaultFont.pointSizeF() > 0
                                             ? defaultFont.pointSizeF() : 13);
        characterFormat.setFontWeight(defaultFont.weight());
    }
    cursor.mergeCharFormat(characterFormat);
}

void SecurityNoteModel::toggleBulletList(QObject *textDocument, int start, int end)
{
    toggleList(textDocument, start, end, QTextListFormat::ListDisc);
}

void SecurityNoteModel::toggleNumberedList(QObject *textDocument, int start, int end)
{
    toggleList(textDocument, start, end, QTextListFormat::ListDecimal);
}

void SecurityNoteModel::changeIndent(QObject *textDocument,
                                     int start,
                                     int end,
                                     int delta)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCursor blockCursor(cursor.block());
    blockCursor.beginEditBlock();
    if (auto *list = blockCursor.currentList()) {
        QTextListFormat format = list->format();
        const int newIndent = std::max(1, format.indent() + delta);
        if (newIndent != format.indent()) {
            format.setIndent(newIndent);
            blockCursor.createList(format);
        }
    } else {
        QTextBlockFormat format = blockCursor.blockFormat();
        format.setIndent(std::max(0, format.indent() + delta));
        blockCursor.setBlockFormat(format);
    }
    blockCursor.endEditBlock();
}

void SecurityNoteModel::setTextColor(QObject *textDocument,
                                     int start,
                                     int end,
                                     const QString &color)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    if (color.isEmpty())
        format.clearForeground();
    else if (QColor selectedColor(color); selectedColor.isValid())
        format.setForeground(selectedColor);
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::setBackgroundColor(QObject *textDocument,
                                           int start,
                                           int end,
                                           const QString &color)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    if (color.isEmpty())
        format.clearBackground();
    else if (QColor selectedColor(color); selectedColor.isValid())
        format.setBackground(selectedColor);
    cursor.mergeCharFormat(format);
}

void SecurityNoteModel::insertLink(QObject *textDocument,
                                   int start,
                                   int end,
                                   const QString &url,
                                   const QString &label)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument || url.trimmed().isEmpty())
        return;

    const QString normalizedUrl = QUrl::fromUserInput(url.trimmed()).toString();
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    QTextCharFormat format;
    format.setAnchor(true);
    format.setAnchorHref(normalizedUrl);
    format.setFontUnderline(true);
    format.setForeground(QColor(QStringLiteral("#3478C9")));

    if (cursor.hasSelection())
        cursor.mergeCharFormat(format);
    else
        cursor.insertText(label.trimmed().isEmpty() ? normalizedUrl : label.trimmed(), format);
}

void SecurityNoteModel::insertTable(QObject *textDocument,
                                    int position,
                                    int rows,
                                    int columns)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));

    QTextTableFormat format;
    format.setBorder(1);
    format.setBorderBrush(QColor(QStringLiteral("#808080")));
    format.setBorderCollapse(true);
    format.setCellPadding(6);
    format.setCellSpacing(0);
    format.setWidth(QTextLength(QTextLength::PercentageLength, 100));
    cursor.insertTable(std::clamp(rows, 1, 20),
                       std::clamp(columns, 1, 10),
                       format);
}

bool SecurityNoteModel::isPositionInTable(QObject *textDocument, int position) const
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument || !quickDocument->textDocument())
        return false;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    return cursor.currentTable() != nullptr;
}

void SecurityNoteModel::insertTableRow(QObject *textDocument,
                                       int position,
                                       bool before)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *table = cursor.currentTable();
    if (!table)
        return;
    const QTextTableCell cell = table->cellAt(cursor);
    table->insertRows(cell.row() + (before ? 0 : 1), 1);
}

void SecurityNoteModel::deleteTableRow(QObject *textDocument, int position)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *table = cursor.currentTable();
    if (!table)
        return;
    const int row = table->cellAt(cursor).row();
    table->removeRows(row, 1);
}

void SecurityNoteModel::insertTableColumn(QObject *textDocument,
                                          int position,
                                          bool before)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *table = cursor.currentTable();
    if (!table)
        return;
    const QTextTableCell cell = table->cellAt(cursor);
    table->insertColumns(cell.column() + (before ? 0 : 1), 1);
}

void SecurityNoteModel::deleteTableColumn(QObject *textDocument, int position)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *table = cursor.currentTable();
    if (!table)
        return;
    const int column = table->cellAt(cursor).column();
    table->removeColumns(column, 1);
}

void SecurityNoteModel::deleteTable(QObject *textDocument, int position)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *table = cursor.currentTable();
    if (table)
        table->removeRows(0, table->rows());
}

int SecurityNoteModel::listStyleAt(QObject *textDocument, int position) const
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument || !quickDocument->textDocument())
        return 0;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    auto *list = cursor.currentList();
    return list ? static_cast<int>(list->format().style()) : 0;
}

int SecurityNoteModel::headingLevelAt(QObject *textDocument, int position) const
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument || !quickDocument->textDocument())
        return 0;
    QTextDocument *document = quickDocument->textDocument();
    QTextCursor cursor(document);
    cursor.setPosition(std::clamp(position, 0, document->characterCount() - 1));
    return std::clamp(cursor.blockFormat().headingLevel(), 0, 2);
}

void SecurityNoteModel::toggleList(QObject *textDocument,
                                   int start,
                                   int end,
                                   int listStyle)
{
    auto *quickDocument = documentFrom(textDocument);
    if (!quickDocument)
        return;
    QTextCursor cursor = selectionCursor(quickDocument->textDocument(), start, end);
    cursor.beginEditBlock();
    if (cursor.currentList()
        && cursor.currentList()->format().style() == listStyle) {
        QTextBlockFormat blockFormat = cursor.blockFormat();
        blockFormat.setObjectIndex(-1);
        cursor.setBlockFormat(blockFormat);
    } else {
        QTextListFormat listFormat;
        listFormat.setStyle(static_cast<QTextListFormat::Style>(listStyle));
        listFormat.setIndent(cursor.blockFormat().indent() + 1);
        cursor.createList(listFormat);
    }
    cursor.endEditBlock();
}

QQuickTextDocument *SecurityNoteModel::documentFrom(QObject *object) const
{
    return qobject_cast<QQuickTextDocument *>(object);
}

void SecurityNoteModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;
    m_lastError = message;
    emit lastErrorChanged();
}
