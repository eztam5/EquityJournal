#pragma once

#include "../repositories/tagrepository.h"

#include <QAbstractItemModel>
#include <QString>

#include <memory>
#include <vector>

class TagTreeModel : public QAbstractItemModel
{
    Q_OBJECT
    Q_PROPERTY(QString lastError READ lastError NOTIFY lastErrorChanged)
    Q_PROPERTY(int tagCount READ tagCount NOTIFY tagCountChanged)

public:
    enum Role {
        TagIdRole = Qt::UserRole + 1,
        TagNameRole,
        DescriptionRole,
        TagColorRole,
        TaxonomyRootRole
    };
    Q_ENUM(Role)

    explicit TagTreeModel(TagRepository &repository, QObject *parent = nullptr);

    QModelIndex index(int row,
                      int column,
                      const QModelIndex &parent = QModelIndex()) const override;
    QModelIndex parent(const QModelIndex &child) const override;
    int rowCount(const QModelIndex &parent = QModelIndex()) const override;
    int columnCount(const QModelIndex &parent = QModelIndex()) const override;
    QVariant data(const QModelIndex &index, int role = Qt::DisplayRole) const override;
    QHash<int, QByteArray> roleNames() const override;

    QString lastError() const;
    int tagCount() const;

    Q_INVOKABLE void loadTaxonomy(const QString &taxonomyId,
                                  const QString &taxonomyName,
                                  const QString &taxonomyColor);
    Q_INVOKABLE bool addTag(const QString &taxonomyId,
                            const QString &parentTagId,
                            const QString &name,
                            const QString &description,
                            const QString &color);
    Q_INVOKABLE bool updateTag(const QString &taxonomyId,
                               const QString &tagId,
                               const QString &name,
                               const QString &description,
                               const QString &color);
    Q_INVOKABLE bool deleteTag(const QString &taxonomyId, const QString &tagId);

signals:
    void lastErrorChanged();
    void tagCountChanged();

private:
    struct Node
    {
        TagRecord tag;
        Node *parent = nullptr;
        bool taxonomyRoot = false;
        std::vector<std::unique_ptr<Node>> children;
    };

    void reload();
    void appendChildren(Node *parentNode, const QString &parentTagId);
    void setLastError(const QString &message);
    static int rowOf(const Node *node);

    TagRepository &m_repository;
    Node m_invisibleRoot;
    QVector<TagRecord> m_tags;
    QString m_taxonomyId;
    QString m_taxonomyName;
    QString m_taxonomyColor;
    QString m_lastError;
    int m_tagCount = 0;
};
