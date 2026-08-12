#include "src/database/databasemanager.h"
#include "src/models/securitymodel.h"
#include "src/models/recentsecuritiesmodel.h"
#include "src/models/securitytagassignmentmodel.h"
#include "src/models/tagtreemodel.h"
#include "src/models/taxonomymodel.h"
#include "src/models/watchlistmodel.h"
#include "src/repositories/sqlsecurityrepository.h"
#include "src/repositories/sqlsecuritytagrepository.h"
#include "src/repositories/sqltagrepository.h"
#include "src/repositories/sqltaxonomyrepository.h"
#include "src/repositories/sqlwatchlistrepository.h"
#include "src/settings/applicationsettings.h"

#include <QGuiApplication>
#include <QDebug>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QStyleHints>
#include <QVariant>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("EquityJournal"));
    QCoreApplication::setApplicationName(QStringLiteral("EquityJournal"));
    QQuickStyle::setStyle("Fusion");

    ApplicationSettings applicationSettings;
    if (applicationSettings.themeMode() == QStringLiteral("dark"))
        app.styleHints()->setColorScheme(Qt::ColorScheme::Dark);
    else if (applicationSettings.themeMode() == QStringLiteral("light"))
        app.styleHints()->setColorScheme(Qt::ColorScheme::Light);
    else
        app.styleHints()->unsetColorScheme();

    DatabaseManager databaseManager;
    QString databaseError;
    if (!databaseManager.initialize(&databaseError)) {
        qCritical().noquote() << databaseError;
        return EXIT_FAILURE;
    }

    SqlWatchlistRepository watchlistRepository(databaseManager.connectionName());
    SqlSecurityRepository securityRepository(databaseManager.connectionName());
    SqlSecurityTagRepository securityTagRepository(databaseManager.connectionName());
    SqlTagRepository tagRepository(databaseManager.connectionName());
    SqlTaxonomyRepository taxonomyRepository(databaseManager.connectionName());
    WatchlistModel watchlistModel(watchlistRepository);
    SecurityModel securityModel(securityRepository);
    RecentSecuritiesModel recentSecuritiesModel(securityModel);
    SecurityTagAssignmentModel securityTagAssignmentModel(securityTagRepository);
    TagTreeModel tagTreeModel(tagRepository);
    TaxonomyModel taxonomyModel(taxonomyRepository);

    QQmlApplicationEngine engine;
    engine.setInitialProperties({
        { QStringLiteral("watchlistModel"),
          QVariant::fromValue(static_cast<QObject *>(&watchlistModel)) },
        { QStringLiteral("securityModel"),
          QVariant::fromValue(static_cast<QObject *>(&securityModel)) },
        { QStringLiteral("recentSecuritiesModel"),
          QVariant::fromValue(static_cast<QObject *>(&recentSecuritiesModel)) },
        { QStringLiteral("securityTagAssignmentModel"),
          QVariant::fromValue(static_cast<QObject *>(&securityTagAssignmentModel)) },
        { QStringLiteral("tagTreeModel"),
          QVariant::fromValue(static_cast<QObject *>(&tagTreeModel)) },
        { QStringLiteral("taxonomyModel"),
          QVariant::fromValue(static_cast<QObject *>(&taxonomyModel)) },
        { QStringLiteral("applicationSettings"),
          QVariant::fromValue(static_cast<QObject *>(&applicationSettings)) }
    });
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        []() { QCoreApplication::exit(-1); },
        Qt::QueuedConnection);
    engine.loadFromModule("EquityJournal", "Main");

    return QGuiApplication::exec();
}
