#pragma once

#include <QString>
#include <QStringList>

class MigrationRunner
{
public:
    static bool migrate(const QString &connectionName, QString *errorMessage = nullptr);

private:
    static QStringList splitStatements(const QString &script);
};
