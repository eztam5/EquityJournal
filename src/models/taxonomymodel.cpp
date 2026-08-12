#include "taxonomymodel.h"

#include <QRegularExpression>

TaxonomyModel::TaxonomyModel(TaxonomyRepository &repository, QObject *parent)
    : QAbstractListModel(parent)
    , m_repository(repository)
{
    m_taxonomies = repository.all(&m_lastError);
}

int TaxonomyModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_taxonomies.size();
}

QVariant TaxonomyModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_taxonomies.size())
        return {};

    const auto &taxonomy = m_taxonomies.at(index.row());
    switch (role) {
    case TaxonomyIdRole:
        return taxonomy.id;
    case NameRole:
    case Qt::DisplayRole:
        return taxonomy.name;
    case DescriptionRole:
        return taxonomy.description;
    case ColorRole:
        return taxonomy.color;
    default:
        return {};
    }
}

QHash<int, QByteArray> TaxonomyModel::roleNames() const
{
    return {
        { TaxonomyIdRole, "taxonomyId" },
        { NameRole, "name" },
        { DescriptionRole, "description" },
        { ColorRole, "taxonomyColor" }
    };
}

QString TaxonomyModel::lastError() const
{
    return m_lastError;
}

bool TaxonomyModel::addTaxonomy(const QString &name,
                                const QString &description,
                                const QString &color)
{
    if (name.trimmed().isEmpty()) {
        setLastError(tr("Enter a taxonomy name."));
        return false;
    }

    static const QRegularExpression colorPattern(QStringLiteral("^#[0-9A-Fa-f]{6}$"));
    if (!colorPattern.match(color.trimmed()).hasMatch()) {
        setLastError(tr("Choose a valid taxonomy color."));
        return false;
    }

    TaxonomyRecord taxonomy;
    QString repositoryError;
    if (!m_repository.add(name, description, color, &taxonomy, &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    const int row = m_taxonomies.size();
    beginInsertRows({}, row, row);
    m_taxonomies.append(taxonomy);
    endInsertRows();
    setLastError({});
    return true;
}

void TaxonomyModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;

    m_lastError = message;
    emit lastErrorChanged();
}
