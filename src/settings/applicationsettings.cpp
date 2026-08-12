#include "applicationsettings.h"

namespace {
constexpr auto ThemeModeKey = "appearance/themeMode";
constexpr auto DefaultThemeMode = "dark";
constexpr auto LegacyOrganizationName = "Investment Journal";
constexpr auto LegacyApplicationName = "Investment Journal";
}

ApplicationSettings::ApplicationSettings(QObject *parent)
    : QObject(parent)
{
    const QString themeModeKey = QString::fromLatin1(ThemeModeKey);
    if (!m_settings.contains(themeModeKey)) {
        QSettings legacySettings(QString::fromLatin1(LegacyOrganizationName),
                                 QString::fromLatin1(LegacyApplicationName));
        if (legacySettings.contains(themeModeKey))
            m_settings.setValue(themeModeKey, legacySettings.value(themeModeKey));
    }

    m_themeMode = validatedThemeMode(
        m_settings.value(themeModeKey, QString::fromLatin1(DefaultThemeMode)).toString());
}

QString ApplicationSettings::themeMode() const
{
    return m_themeMode;
}

void ApplicationSettings::setThemeMode(const QString &themeMode)
{
    const QString validatedMode = validatedThemeMode(themeMode);
    if (m_themeMode == validatedMode)
        return;

    m_themeMode = validatedMode;
    m_settings.setValue(QString::fromLatin1(ThemeModeKey), m_themeMode);
    m_settings.sync();
    emit themeModeChanged();
}

QString ApplicationSettings::validatedThemeMode(const QString &themeMode)
{
    if (themeMode == QStringLiteral("dark")
        || themeMode == QStringLiteral("light")
        || themeMode == QStringLiteral("system")) {
        return themeMode;
    }

    return QString::fromLatin1(DefaultThemeMode);
}
