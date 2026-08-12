#pragma once

#include <QObject>
#include <QSettings>
#include <QString>

class ApplicationSettings final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(QString themeMode READ themeMode WRITE setThemeMode NOTIFY themeModeChanged)

public:
    explicit ApplicationSettings(QObject *parent = nullptr);

    QString themeMode() const;
    void setThemeMode(const QString &themeMode);

signals:
    void themeModeChanged();

private:
    static QString validatedThemeMode(const QString &themeMode);

    QSettings m_settings;
    QString m_themeMode;
};
