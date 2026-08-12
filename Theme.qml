pragma Singleton

import QtQuick

QtObject {
    property string mode: "system"
    readonly property bool dark: mode === "dark"
                                 || (mode === "system"
                                     && Application.styleHints.colorScheme === Qt.Dark)

    readonly property color windowBackground: dark ? "#20242a" : "#f7f8fa"
    readonly property color contentBackground: dark ? "#171a1f" : "#ffffff"
    readonly property color sidebarBackground: dark ? "#20242a" : "#f0f2f5"
    readonly property color border: dark ? "#363c46" : "#d7dbe2"
    readonly property color textPrimary: dark ? "#f2f4f7" : "#172033"
    readonly property color textSecondary: dark ? "#d0d5dd" : "#344054"
    readonly property color textMuted: dark ? "#98a2b3" : "#5c6574"
    readonly property color hover: dark ? "#2c323b" : "#e1e5eb"
    readonly property color selected: dark ? "#343b47" : "#e5eaf1"
    readonly property color pressed: dark ? "#294d77" : "#d8e6fb"
    readonly property color accent: dark ? "#78aef5" : "#1f5fbf"
    readonly property color accentText: "#ffffff"
    readonly property color resizeHandle: dark ? "#526277" : "#b7c9e5"
    readonly property color error: dark ? "#f97066" : "#b42318"

    readonly property int navigationItemHeight: 38
    readonly property int smallRadius: 6
    readonly property int mediumRadius: 7
    readonly property int sidebarPadding: 16

    function setMode(requestedMode) {
        if (requestedMode !== "dark" && requestedMode !== "light" && requestedMode !== "system")
            return

        mode = requestedMode
        if (mode === "dark")
            Application.styleHints.colorScheme = Qt.Dark
        else if (mode === "light")
            Application.styleHints.colorScheme = Qt.Light
        else
            Application.styleHints.colorScheme = Qt.Unknown
    }
}
