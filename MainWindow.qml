import QtQuick
import QtQuick.Window
import QtQuick.Controls

ApplicationWindow {
    id: root

    required property var watchlistModel
    required property var securityModel
    required property var taxonomyModel
    required property var applicationSettings

    width: 1280
    height: 800
    minimumWidth: 760
    minimumHeight: 520
    visible: true
    visibility: Window.Maximized
    title: qsTr("EquityJournal")
    color: Theme.windowBackground
    palette.window: Theme.windowBackground
    palette.windowText: Theme.textPrimary
    palette.base: Theme.contentBackground
    palette.alternateBase: Theme.sidebarBackground
    palette.text: Theme.textPrimary
    palette.button: Theme.selected
    palette.buttonText: Theme.textPrimary
    palette.highlight: Theme.accent
    palette.highlightedText: Theme.accentText
    palette.placeholderText: Theme.textMuted

    property string currentView: "allSecurities"
    property string currentEntityId: "all"
    property string currentTitle: qsTr("All Securities")

    function selectTheme(mode) {
        root.applicationSettings.themeMode = mode
        Theme.setMode(mode)
    }

    Component.onCompleted: Theme.setMode(root.applicationSettings.themeMode)

    menuBar: MenuBar {
        Menu {
            title: qsTr("View")

            ActionGroup {
                id: themeActions
                exclusive: true
            }

            Action {
                text: qsTr("Dark")
                checkable: true
                checked: root.applicationSettings.themeMode === "dark"
                ActionGroup.group: themeActions
                onTriggered: root.selectTheme("dark")
            }

            Action {
                text: qsTr("Light")
                checkable: true
                checked: root.applicationSettings.themeMode === "light"
                ActionGroup.group: themeActions
                onTriggered: root.selectTheme("light")
            }

            Action {
                text: qsTr("System")
                checkable: true
                checked: root.applicationSettings.themeMode === "system"
                ActionGroup.group: themeActions
                onTriggered: root.selectTheme("system")
            }
        }
    }

    SplitView {
        anchors.fill: parent
        orientation: Qt.Horizontal

        handle: Rectangle {
            implicitWidth: 6
            color: SplitHandle.pressed || SplitHandle.hovered ? Theme.resizeHandle : "transparent"
        }

        NavigationSidebar {
            id: sidebar
            watchlistModel: root.watchlistModel
            taxonomyModel: root.taxonomyModel
            currentEntityId: root.currentEntityId
            SplitView.preferredWidth: 280
            SplitView.minimumWidth: 210
            SplitView.maximumWidth: Math.min(480, root.width * 0.45)

            onNewSecurityRequested: newSecurityWindow.openWindow()
            onNewWatchlistRequested: newWatchlistWindow.openWindow()
            onNewTaxonomyRequested: newTaxonomyWindow.openWindow()
            onNavigationRequested: function(viewType, entityId, title) {
                root.currentView = viewType
                root.currentEntityId = entityId
                root.currentTitle = title
            }
        }

        ContentRouter {
            currentView: root.currentView
            currentTitle: root.currentTitle
            securityModel: root.securityModel
            SplitView.fillWidth: true
            onEditSecurityRequested: function(row) { newSecurityWindow.openForEdit(row) }
            onDeleteSecurityRequested: function(securityId, companyName) {
                deleteSecurityWindow.openForSecurity(securityId, companyName)
            }
        }
    }

    NewSecurityWindow {
        id: newSecurityWindow
        ownerWindow: root
        securityModel: root.securityModel
    }

    NewWatchlistWindow {
        id: newWatchlistWindow
        ownerWindow: root
        watchlistModel: root.watchlistModel
    }

    NewTaxonomyWindow {
        id: newTaxonomyWindow
        ownerWindow: root
        taxonomyModel: root.taxonomyModel
    }

    DeleteSecurityWindow {
        id: deleteSecurityWindow
        ownerWindow: root
        securityModel: root.securityModel
    }
}
