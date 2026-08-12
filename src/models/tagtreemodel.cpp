#include "tagtreemodel.h"

#include <QRegularExpression>

#include <utility>

TagTreeModel::TagTreeModel(TagRepository &repository, QObject *parent)
    : QAbstractItemModel(parent)
    , m_repository(repository)
{
}

QModelIndex TagTreeModel::index(int row, int column, const QModelIndex &parentIndex) const
{
    if (row < 0 || column != 0)
        return {};

    auto *parentNode = parentIndex.isValid()
        ? static_cast<Node *>(parentIndex.internalPointer())
        : const_cast<Node *>(&m_invisibleRoot);
    if (!parentNode || row >= static_cast<int>(parentNode->children.size()))
        return {};

    return createIndex(row, column, parentNode->children.at(row).get());
}

QModelIndex TagTreeModel::parent(const QModelIndex &child) const
{
    if (!child.isValid())
        return {};

    auto *node = static_cast<Node *>(child.internalPointer());
    auto *parentNode = node ? node->parent : nullptr;
    if (!parentNode || parentNode == &m_invisibleRoot)
        return {};

    return createIndex(rowOf(parentNode), 0, parentNode);
}

int TagTreeModel::rowCount(const QModelIndex &parentIndex) const
{
    if (parentIndex.isValid() && parentIndex.column() != 0)
        return 0;

    auto *parentNode = parentIndex.isValid()
        ? static_cast<Node *>(parentIndex.internalPointer())
        : const_cast<Node *>(&m_invisibleRoot);
    return parentNode ? static_cast<int>(parentNode->children.size()) : 0;
}

int TagTreeModel::columnCount(const QModelIndex &) const
{
    return 1;
}

QVariant TagTreeModel::data(const QModelIndex &modelIndex, int role) const
{
    if (!modelIndex.isValid())
        return {};

    const auto *node = static_cast<Node *>(modelIndex.internalPointer());
    if (!node)
        return {};

    switch (role) {
    case Qt::DisplayRole:
    case TagNameRole:
        return node->tag.name;
    case TagIdRole:
        return node->tag.id;
    case DescriptionRole:
        return node->tag.description;
    case TagColorRole:
        return node->tag.color;
    case TaxonomyRootRole:
        return node->taxonomyRoot;
    default:
        return {};
    }
}

QHash<int, QByteArray> TagTreeModel::roleNames() const
{
    return {
        { TagIdRole, "tagId" },
        { TagNameRole, "tagName" },
        { DescriptionRole, "description" },
        { TagColorRole, "tagColor" },
        { TaxonomyRootRole, "taxonomyRoot" }
    };
}

QString TagTreeModel::lastError() const
{
    return m_lastError;
}

int TagTreeModel::tagCount() const
{
    return m_tagCount;
}

void TagTreeModel::loadTaxonomy(const QString &taxonomyId,
                                const QString &taxonomyName,
                                const QString &taxonomyColor)
{
    m_taxonomyId = taxonomyId.trimmed();
    m_taxonomyName = taxonomyName.trimmed();
    m_taxonomyColor = taxonomyColor.trimmed().toUpper();
    reload();
}

bool TagTreeModel::addTag(const QString &taxonomyId,
                          const QString &parentTagId,
                          const QString &name,
                          const QString &description,
                          const QString &color)
{
    const QString targetTaxonomyId = taxonomyId.trimmed();
    if (targetTaxonomyId.isEmpty()) {
        setLastError(tr("Select a taxonomy first."));
        return false;
    }
    if (name.trimmed().isEmpty()) {
        setLastError(tr("Enter a tag name."));
        return false;
    }

    static const QRegularExpression colorPattern(QStringLiteral("^#[0-9A-Fa-f]{6}$"));
    if (!colorPattern.match(color.trimmed()).hasMatch()) {
        setLastError(tr("Choose a valid tag color."));
        return false;
    }

    TagRecord createdTag;
    QString repositoryError;
    if (!m_repository.add(targetTaxonomyId,
                          parentTagId,
                          name,
                          description,
                          color,
                          &createdTag,
                          &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    if (targetTaxonomyId == m_taxonomyId)
        reload();
    else
        setLastError({});
    return m_lastError.isEmpty();
}

bool TagTreeModel::updateTag(const QString &taxonomyId,
                             const QString &tagId,
                             const QString &name,
                             const QString &description,
                             const QString &color)
{
    const QString targetTaxonomyId = taxonomyId.trimmed();
    if (targetTaxonomyId.isEmpty() || tagId.trimmed().isEmpty()) {
        setLastError(tr("The selected tag is invalid."));
        return false;
    }
    if (name.trimmed().isEmpty()) {
        setLastError(tr("Enter a tag name."));
        return false;
    }

    static const QRegularExpression colorPattern(QStringLiteral("^#[0-9A-Fa-f]{6}$"));
    if (!colorPattern.match(color.trimmed()).hasMatch()) {
        setLastError(tr("Choose a valid tag color."));
        return false;
    }

    QString repositoryError;
    if (!m_repository.update(targetTaxonomyId,
                             tagId,
                             name,
                             description,
                             color,
                             &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    if (targetTaxonomyId == m_taxonomyId)
        reload();
    else
        setLastError({});
    return m_lastError.isEmpty();
}

bool TagTreeModel::deleteTag(const QString &taxonomyId, const QString &tagId)
{
    const QString targetTaxonomyId = taxonomyId.trimmed();
    if (targetTaxonomyId.isEmpty() || tagId.trimmed().isEmpty()) {
        setLastError(tr("The selected tag is invalid."));
        return false;
    }

    QString repositoryError;
    if (!m_repository.remove(targetTaxonomyId, tagId, &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    if (targetTaxonomyId == m_taxonomyId)
        reload();
    else
        setLastError({});
    return m_lastError.isEmpty();
}

void TagTreeModel::reload()
{
    QString repositoryError;
    const auto tags = m_taxonomyId.isEmpty()
        ? QVector<TagRecord>()
        : m_repository.allForTaxonomy(m_taxonomyId, &repositoryError);

    beginResetModel();
    m_invisibleRoot.children.clear();
    m_tags = tags;

    if (!m_taxonomyId.isEmpty()) {
        auto taxonomyNode = std::make_unique<Node>();
        taxonomyNode->tag.taxonomyId = m_taxonomyId;
        taxonomyNode->tag.name = m_taxonomyName;
        taxonomyNode->tag.color = m_taxonomyColor;
        taxonomyNode->parent = &m_invisibleRoot;
        taxonomyNode->taxonomyRoot = true;
        appendChildren(taxonomyNode.get(), {});
        m_invisibleRoot.children.push_back(std::move(taxonomyNode));
    }
    endResetModel();

    const int previousCount = m_tagCount;
    m_tagCount = m_tags.size();
    if (previousCount != m_tagCount)
        emit tagCountChanged();
    setLastError(repositoryError);
}

void TagTreeModel::appendChildren(Node *parentNode, const QString &parentTagId)
{
    for (const auto &tag : std::as_const(m_tags)) {
        if (tag.parentId != parentTagId)
            continue;

        auto child = std::make_unique<Node>();
        child->tag = tag;
        child->parent = parentNode;
        appendChildren(child.get(), tag.id);
        parentNode->children.push_back(std::move(child));
    }
}

void TagTreeModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;

    m_lastError = message;
    emit lastErrorChanged();
}

int TagTreeModel::rowOf(const Node *node)
{
    if (!node || !node->parent)
        return -1;

    const auto &siblings = node->parent->children;
    for (int row = 0; row < static_cast<int>(siblings.size()); ++row) {
        if (siblings.at(row).get() == node)
            return row;
    }
    return -1;
}
