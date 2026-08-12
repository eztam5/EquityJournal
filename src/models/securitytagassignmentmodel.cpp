#include "securitytagassignmentmodel.h"

#include <QVariantMap>

SecurityTagAssignmentModel::SecurityTagAssignmentModel(SecurityTagRepository &repository,
                                                       QObject *parent)
    : QAbstractItemModel(parent)
    , m_repository(repository)
{
}

QModelIndex SecurityTagAssignmentModel::index(int row,
                                              int column,
                                              const QModelIndex &parentIndex) const
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

QModelIndex SecurityTagAssignmentModel::parent(const QModelIndex &child) const
{
    if (!child.isValid())
        return {};
    auto *node = static_cast<Node *>(child.internalPointer());
    auto *parentNode = node ? node->parent : nullptr;
    if (!parentNode || parentNode == &m_invisibleRoot)
        return {};
    return createIndex(rowOf(parentNode), 0, parentNode);
}

int SecurityTagAssignmentModel::rowCount(const QModelIndex &parentIndex) const
{
    if (parentIndex.isValid() && parentIndex.column() != 0)
        return 0;
    auto *parentNode = parentIndex.isValid()
        ? static_cast<Node *>(parentIndex.internalPointer())
        : const_cast<Node *>(&m_invisibleRoot);
    return parentNode ? static_cast<int>(parentNode->children.size()) : 0;
}

int SecurityTagAssignmentModel::columnCount(const QModelIndex &) const
{
    return 1;
}

QVariant SecurityTagAssignmentModel::data(const QModelIndex &modelIndex, int role) const
{
    if (!modelIndex.isValid())
        return {};
    const auto *node = static_cast<Node *>(modelIndex.internalPointer());
    if (!node)
        return {};

    switch (role) {
    case Qt::DisplayRole:
    case NodeNameRole:
        return node->name;
    case NodeIdRole:
        return node->id;
    case NodeColorRole:
        return node->color;
    case DescriptionRole:
        return node->description;
    case TaxonomyRootRole:
        return node->taxonomyRoot;
    case CheckedRole:
        return !node->taxonomyRoot && m_draftTagIds.contains(node->id);
    default:
        return {};
    }
}

QHash<int, QByteArray> SecurityTagAssignmentModel::roleNames() const
{
    return {
        { NodeIdRole, "nodeId" },
        { NodeNameRole, "nodeName" },
        { NodeColorRole, "nodeColor" },
        { DescriptionRole, "description" },
        { TaxonomyRootRole, "taxonomyRoot" },
        { CheckedRole, "checked" }
    };
}

QString SecurityTagAssignmentModel::filterText() const { return m_filterText; }

void SecurityTagAssignmentModel::setFilterText(const QString &filterText)
{
    const QString normalized = filterText.trimmed();
    if (m_filterText == normalized)
        return;
    m_filterText = normalized;
    emit filterTextChanged();
    rebuildTree();
}

QString SecurityTagAssignmentModel::lastError() const { return m_lastError; }

QVariantList SecurityTagAssignmentModel::assignedGroups() const
{
    QVariantList groups;
    for (const auto &taxonomy : m_data.taxonomies) {
        QVariantList tags;
        for (const auto &tag : taxonomy.tags) {
            if (!m_data.assignedTagIds.contains(tag.id))
                continue;
            tags.append(QVariantMap {
                { QStringLiteral("id"), tag.id },
                { QStringLiteral("name"), tag.name },
                { QStringLiteral("color"), tag.color.isEmpty() ? taxonomy.color : tag.color }
            });
        }
        if (!tags.isEmpty()) {
            groups.append(QVariantMap {
                { QStringLiteral("taxonomyName"), taxonomy.name },
                { QStringLiteral("taxonomyColor"), taxonomy.color },
                { QStringLiteral("tags"), tags }
            });
        }
    }
    return groups;
}

int SecurityTagAssignmentModel::assignedCount() const
{
    return m_data.assignedTagIds.size();
}

bool SecurityTagAssignmentModel::loadSecurity(const QString &securityId)
{
    QString error;
    auto loaded = m_repository.load(securityId, &error);
    if (!error.isEmpty()) {
        setLastError(error);
        return false;
    }
    m_securityId = securityId;
    m_data = std::move(loaded);
    m_draftTagIds = m_data.assignedTagIds;
    setLastError({});
    rebuildTree();
    emit assignedGroupsChanged();
    return true;
}

bool SecurityTagAssignmentModel::beginEditing(const QString &securityId)
{
    setFilterText({});
    return loadSecurity(securityId);
}

void SecurityTagAssignmentModel::cancelEditing()
{
    m_draftTagIds = m_data.assignedTagIds;
    rebuildTree();
    setFilterText({});
}

void SecurityTagAssignmentModel::setTagChecked(const QString &tagId, bool checked)
{
    if (tagId.isEmpty())
        return;
    if (checked)
        m_draftTagIds.insert(tagId);
    else
        m_draftTagIds.remove(tagId);

    if (auto *node = findNode(&m_invisibleRoot, tagId)) {
        const QModelIndex changed = createIndex(rowOf(node), 0, node);
        emit dataChanged(changed, changed, { CheckedRole });
    }
}

bool SecurityTagAssignmentModel::apply()
{
    QString error;
    if (!m_repository.replace(m_securityId, m_draftTagIds, &error)) {
        setLastError(error);
        return false;
    }
    m_data.assignedTagIds = m_draftTagIds;
    setLastError({});
    emit assignedGroupsChanged();
    return true;
}

bool SecurityTagAssignmentModel::removeAssignedTag(const QString &securityId,
                                                   const QString &tagId)
{
    if (securityId != m_securityId && !loadSecurity(securityId))
        return false;
    QSet<QString> updated = m_data.assignedTagIds;
    updated.remove(tagId);

    QString error;
    if (!m_repository.replace(securityId, updated, &error)) {
        setLastError(error);
        return false;
    }
    m_data.assignedTagIds = updated;
    m_draftTagIds = updated;
    rebuildTree();
    setLastError({});
    emit assignedGroupsChanged();
    return true;
}

void SecurityTagAssignmentModel::rebuildTree()
{
    beginResetModel();
    m_invisibleRoot.children.clear();
    for (const auto &taxonomy : m_data.taxonomies) {
        auto taxonomyNode = std::make_unique<Node>();
        taxonomyNode->id = taxonomy.id;
        taxonomyNode->name = taxonomy.name;
        taxonomyNode->color = taxonomy.color;
        taxonomyNode->taxonomyRoot = true;
        taxonomyNode->parent = &m_invisibleRoot;

        for (const auto &tag : taxonomy.tags) {
            if (!tag.parentId.isEmpty())
                continue;
            appendMatchingTag(taxonomyNode.get(), taxonomy, tag);
        }
        if (m_filterText.isEmpty() || !taxonomyNode->children.empty())
            m_invisibleRoot.children.push_back(std::move(taxonomyNode));
    }
    endResetModel();
}

bool SecurityTagAssignmentModel::appendMatchingTag(
    Node *parent,
    const AssignableTaxonomyRecord &taxonomy,
    const AssignableTagRecord &tag)
{
    auto node = std::make_unique<Node>();
    node->id = tag.id;
    node->name = tag.name;
    node->description = tag.description;
    node->color = tag.color.isEmpty() ? taxonomy.color : tag.color;
    node->parent = parent;

    for (const auto &childTag : taxonomy.tags) {
        if (childTag.parentId == tag.id)
            appendMatchingTag(node.get(), taxonomy, childTag);
    }

    const bool matches = tagMatches(taxonomy, tag) || !node->children.empty();
    if (matches)
        parent->children.push_back(std::move(node));
    return matches;
}

bool SecurityTagAssignmentModel::tagMatches(
    const AssignableTaxonomyRecord &taxonomy,
    const AssignableTagRecord &tag) const
{
    return m_filterText.isEmpty()
        || tag.name.contains(m_filterText, Qt::CaseInsensitive)
        || tag.description.contains(m_filterText, Qt::CaseInsensitive)
        || taxonomy.name.contains(m_filterText, Qt::CaseInsensitive);
}

SecurityTagAssignmentModel::Node *SecurityTagAssignmentModel::findNode(
    Node *parent,
    const QString &id) const
{
    for (const auto &child : parent->children) {
        if (!child->taxonomyRoot && child->id == id)
            return child.get();
        if (auto *match = findNode(child.get(), id))
            return match;
    }
    return nullptr;
}

int SecurityTagAssignmentModel::rowOf(const Node *node)
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

void SecurityTagAssignmentModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;
    m_lastError = message;
    emit lastErrorChanged();
}
