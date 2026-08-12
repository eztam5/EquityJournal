#include "recentsecuritiesmodel.h"

#include "securitymodel.h"

#include <QVariantMap>

#include <utility>

namespace {
constexpr auto RecentSecurityIdsKey = "navigation/recentSecurityIds";
constexpr int MaximumRecentSecurities = 5;

SecurityRecord recordFromMap(const QVariantMap &values)
{
    return {
        values.value(QStringLiteral("id")).toString(),
        values.value(QStringLiteral("name")).toString(),
        values.value(QStringLiteral("symbol")).toString(),
        values.value(QStringLiteral("currency")).toString()
    };
}
}

RecentSecuritiesModel::RecentSecuritiesModel(SecurityModel &securityModel,
                                             QObject *parent)
    : QAbstractListModel(parent)
    , m_securityModel(securityModel)
{
    connect(&m_securityModel,
            &SecurityModel::securityUpdated,
            this,
            &RecentSecuritiesModel::handleSecurityUpdated);
    connect(&m_securityModel,
            &SecurityModel::securityDeleted,
            this,
            &RecentSecuritiesModel::handleSecurityDeleted);
    load();
}

int RecentSecuritiesModel::rowCount(const QModelIndex &parent) const
{
    return parent.isValid() ? 0 : m_securities.size();
}

QVariant RecentSecuritiesModel::data(const QModelIndex &index, int role) const
{
    if (!index.isValid() || index.row() < 0 || index.row() >= m_securities.size())
        return {};

    const auto &security = m_securities.at(index.row());
    switch (role) {
    case SecurityIdRole:
        return security.id;
    case NameRole:
        return security.name;
    case SymbolRole:
        return security.symbol;
    case CurrencyRole:
        return security.currency;
    case Qt::DisplayRole:
        return QStringLiteral("%1 — %2").arg(security.symbol, security.name);
    default:
        return {};
    }
}

QHash<int, QByteArray> RecentSecuritiesModel::roleNames() const
{
    return {
        { SecurityIdRole, "securityId" },
        { NameRole, "name" },
        { SymbolRole, "symbol" },
        { CurrencyRole, "currency" },
        { Qt::DisplayRole, "display" }
    };
}

int RecentSecuritiesModel::count() const
{
    return m_securities.size();
}

bool RecentSecuritiesModel::recordView(const QString &securityId)
{
    const auto values = m_securityModel.securityById(securityId);
    if (values.isEmpty())
        return false;

    const SecurityRecord security = recordFromMap(values);
    const int existingIndex = indexOf(security.id);
    if (existingIndex == 0) {
        m_securities[0] = security;
        emit dataChanged(index(0), index(0));
        return true;
    }

    const int previousCount = m_securities.size();
    beginResetModel();
    if (existingIndex > 0)
        m_securities.removeAt(existingIndex);
    m_securities.prepend(security);
    while (m_securities.size() > MaximumRecentSecurities)
        m_securities.removeLast();
    endResetModel();

    if (previousCount != m_securities.size())
        emit countChanged();
    save();
    return true;
}

void RecentSecuritiesModel::handleSecurityUpdated(const QString &securityId)
{
    const int row = indexOf(securityId);
    if (row < 0)
        return;

    const auto values = m_securityModel.securityById(securityId);
    if (values.isEmpty()) {
        handleSecurityDeleted(securityId);
        return;
    }

    m_securities[row] = recordFromMap(values);
    emit dataChanged(index(row), index(row));
}

void RecentSecuritiesModel::handleSecurityDeleted(const QString &securityId)
{
    const int row = indexOf(securityId);
    if (row < 0)
        return;

    beginRemoveRows({}, row, row);
    m_securities.removeAt(row);
    endRemoveRows();
    emit countChanged();
    save();
}

void RecentSecuritiesModel::load()
{
    const QStringList storedIds =
        m_settings.value(QString::fromLatin1(RecentSecurityIdsKey)).toStringList();
    QStringList validIds;

    for (const auto &securityId : storedIds) {
        if (validIds.contains(securityId) || validIds.size() >= MaximumRecentSecurities)
            continue;

        const auto values = m_securityModel.securityById(securityId);
        if (values.isEmpty())
            continue;

        m_securities.append(recordFromMap(values));
        validIds.append(securityId);
    }

    if (validIds != storedIds)
        save();
}

void RecentSecuritiesModel::save()
{
    QStringList ids;
    ids.reserve(m_securities.size());
    for (const auto &security : std::as_const(m_securities))
        ids.append(security.id);

    m_settings.setValue(QString::fromLatin1(RecentSecurityIdsKey), ids);
    m_settings.sync();
}

int RecentSecuritiesModel::indexOf(const QString &securityId) const
{
    for (int row = 0; row < m_securities.size(); ++row) {
        if (m_securities.at(row).id == securityId)
            return row;
    }
    return -1;
}
