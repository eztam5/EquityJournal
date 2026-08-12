#include "securitymodel.h"

#include <algorithm>

SecurityModel::SecurityModel(SecurityRepository &repository, QObject *parent)
    : QAbstractTableModel(parent)
    , m_repository(repository)
{
    m_securities = repository.all(&m_lastError);
}

int SecurityModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_securities.size();
}

int SecurityModel::columnCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : ColumnCount;
}

QVariant SecurityModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_securities.size())
        return {};
    if (role != Qt::DisplayRole)
        return {};

    const auto &security = m_securities.at(index.row());
    switch (index.column()) {
    case SymbolColumn:
        return security.symbol;
    case NameColumn:
        return security.name;
    case CurrencyColumn:
        return security.currency;
    default:
        return {};
    }
}

QVariant SecurityModel::headerData(int section, Qt::Orientation orientation, int role) const
{
    if (orientation != Qt::Horizontal || role != Qt::DisplayRole)
        return {};

    switch (section) {
    case SymbolColumn:
        return tr("Symbol");
    case NameColumn:
        return tr("Company Name");
    case CurrencyColumn:
        return tr("Currency");
    default:
        return {};
    }
}

QHash<int, QByteArray> SecurityModel::roleNames() const
{
    return { { Qt::DisplayRole, "display" } };
}

int SecurityModel::count() const
{
    return m_securities.size();
}

QString SecurityModel::lastError() const
{
    return m_lastError;
}

bool SecurityModel::addSecurity(const QString &symbol,
                                const QString &currency,
                                const QString &companyName)
{
    if (symbol.trimmed().isEmpty()) {
        setLastError(tr("Enter a symbol."));
        return false;
    }
    if (currency.trimmed().isEmpty()) {
        setLastError(tr("Enter a currency."));
        return false;
    }
    if (companyName.trimmed().isEmpty()) {
        setLastError(tr("Enter a company name."));
        return false;
    }

    SecurityRecord security;
    QString repositoryError;
    if (!m_repository.add(symbol, currency, companyName, &security, &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    const auto position = std::lower_bound(
        m_securities.cbegin(), m_securities.cend(), security,
        [](const SecurityRecord &left, const SecurityRecord &right) {
            const int symbolComparison = left.symbol.compare(right.symbol, Qt::CaseInsensitive);
            return symbolComparison != 0 ? symbolComparison < 0 : left.id < right.id;
        });
    const int row = static_cast<int>(std::distance(m_securities.cbegin(), position));

    beginInsertRows({}, row, row);
    m_securities.insert(row, security);
    endInsertRows();
    emit countChanged();

    setLastError({});
    return true;
}

QVariantMap SecurityModel::securityAt(int row) const
{
    if (row < 0 || row >= m_securities.size())
        return {};

    const auto &security = m_securities.at(row);
    return {
        { QStringLiteral("id"), security.id },
        { QStringLiteral("name"), security.name },
        { QStringLiteral("symbol"), security.symbol },
        { QStringLiteral("currency"), security.currency }
    };
}

QVariantMap SecurityModel::securityById(const QString &id) const
{
    const auto position = std::find_if(
        m_securities.cbegin(), m_securities.cend(),
        [&id](const SecurityRecord &security) { return security.id == id; });
    if (position == m_securities.cend())
        return {};

    return {
        { QStringLiteral("id"), position->id },
        { QStringLiteral("name"), position->name },
        { QStringLiteral("symbol"), position->symbol },
        { QStringLiteral("currency"), position->currency }
    };
}

bool SecurityModel::updateSecurity(const QString &id,
                                   const QString &symbol,
                                   const QString &currency,
                                   const QString &companyName)
{
    if (symbol.trimmed().isEmpty()) {
        setLastError(tr("Enter a symbol."));
        return false;
    }
    if (currency.trimmed().isEmpty()) {
        setLastError(tr("Enter a currency."));
        return false;
    }
    if (companyName.trimmed().isEmpty()) {
        setLastError(tr("Enter a company name."));
        return false;
    }

    SecurityRecord updatedSecurity;
    QString repositoryError;
    if (!m_repository.update(id,
                             symbol,
                             currency,
                             companyName,
                             &updatedSecurity,
                             &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    QString reloadError;
    const auto reloadedSecurities = m_repository.all(&reloadError);
    if (!reloadError.isEmpty()) {
        setLastError(reloadError);
        return false;
    }

    beginResetModel();
    m_securities = reloadedSecurities;
    endResetModel();
    setLastError({});
    emit securityUpdated(id);
    return true;
}

bool SecurityModel::deleteSecurity(const QString &id)
{
    const auto position = std::find_if(
        m_securities.cbegin(), m_securities.cend(),
        [&id](const SecurityRecord &security) { return security.id == id; });
    if (position == m_securities.cend()) {
        setLastError(tr("The security no longer exists."));
        return false;
    }

    QString repositoryError;
    if (!m_repository.remove(id, &repositoryError)) {
        setLastError(repositoryError);
        return false;
    }

    const int row = static_cast<int>(std::distance(m_securities.cbegin(), position));
    beginRemoveRows({}, row, row);
    m_securities.removeAt(row);
    endRemoveRows();
    emit countChanged();
    setLastError({});
    emit securityDeleted(id);
    return true;
}

void SecurityModel::setLastError(const QString &message)
{
    if (m_lastError == message)
        return;

    m_lastError = message;
    emit lastErrorChanged();
}
