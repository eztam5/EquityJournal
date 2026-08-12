#pragma once

#include "../repositories/securitytagrepository.h"

#include <QAbstractItemModel>
#include <QSet>
#include <QVariantList>

#include <memory>
#include <vector>

class SecurityTagAssignmentModel final : public QAbstractItemModel
{
    Q_OBJECT
    Q_PROPERTY(QString filterText READ filterText WRITE setFilterText NOTIFY filterTextChanged)
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(QVariantList assignedGroups READ assignedGroups NOTIFY assignedGroupsChanged)
    Q_PROPERTY(int assignedCount READ assignedCount NOTIFY assignedGroupsChanged)

public:
    enum Role {
        NodeIdRole = Qt::UserRole + 1,
        NodeNameRole,
        NodeColorRole,
        DescriptionRole,
        TaxonomyRootRole,
        CheckedRole
    };
    Q_ENUM(Role)

    explicit SecurityTagAssignmentModel(SecurityTagRepository &repository,
                                        QObject *parent = nullptr);

    QModelIndex index(int row, int column, const QModelIndex &parent = {}) const override;
    QModelIndex parent(const QModelIndex &child) const override;
    int rowCount(const QModelIndex &parent = {}) const override;
    int columnCount(const QModelIndex &parent = {}) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString filterText() const;
    void setFilterText(const QString &filterText);
    QString lastError() const;
    QVariantList assignedGroups() const;
    int assignedCount() const;

    Q_INVOKABLE bool loadSecurity(const QString &securityId);
    Q_INVOKABLE bool beginEditing(const QString &securityId);
    Q_INVOKABLE void cancelEditing();
    Q_INVOKABLE void setTagChecked(const QString &tagId, bool checked);
    Q_INVOKABLE bool apply();
    Q_INVOKABLE bool removeAssignedTag(const QString &securityId, const QString &tagId);

signals:
    void filterTextChanged();
    void lastErrorChanged();
    void assignedGroupsChanged();

private:
    struct Node
    {
        QString id;
        QString name;
        QString description;
        QString color;
        bool taxonomyRoot = false;
        Node *parent = nullptr;
        std::vector<std::unique_ptr<Node>> children;
    };

    void rebuildTree();
    bool appendMatchingTag(Node *parent,
                           const AssignableTaxonomyRecord &taxonomy,
                           const AssignableTagRecord &tag);
    bool tagMatches(const AssignableTaxonomyRecord &taxonomy,
                    const AssignableTagRecord &tag) const;
    Node *findNode(Node *parent, const QString &id) const;
    static int rowOf(const Node *node);
    void setLastError(const QString &message);

    SecurityTagRepository &m_repository;
    SecurityTagAssignmentData m_data;
    Node m_invisibleRoot;
    QSet<QString> m_draftTagIds;
    QString m_securityId;
    QString m_filterText;
    QString m_lastError;
};
