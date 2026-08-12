#pragma once

#include <QString>

class DatabaseManager
{
public:
    explicit DatabaseManager(QString databasePath = {});
    ~DatabaseManager();

    DatabaseManager(const DatabaseManager &) = delete;
    DatabaseManager &operator=(const DatabaseManager &) = delete;

    bool initialize(QString *errorMessage = nullptr);

    QString connectionName() const;
    QString databasePath() const;

private:
    QString resolvedDatabasePath() const;
    QString legacyDatabasePath() const;

    QString m_requestedDatabasePath;
    QString m_databasePath;
    QString m_connectionName;
    bool m_initialized = false;
};
