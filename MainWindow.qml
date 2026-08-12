import QtQuick
import QtQuick.Window
import QtQuick.Controls

ApplicationWindow {
    id: root

    required property var watchlistModel
    required property var securityModel
    required property var recentSecuritiesModel
    required property var securityTagAssignmentModel
    required property var tagTreeModel
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
    property string currentEntityColor: ""

    function selectTheme(mode) {
        root.applicationSettings.themeMode = mode
        Theme.setMode(mode)
    }

    function openSecurity(securityId) {
        const security = root.securityModel.securityById(securityId)
        if (!security.id || !root.recentSecuritiesModel.recordView(securityId))
            return

        root.currentView = "securityDetail"
        root.currentEntityId = security.id
        root.currentTitle = security.symbol + " — " + security.name
        root.currentEntityColor = ""
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
            recentSecuritiesModel: root.recentSecuritiesModel
            currentView: root.currentView
            currentEntityId: root.currentEntityId
            SplitView.preferredWidth: 280
            SplitView.minimumWidth: 210
            SplitView.maximumWidth: Math.min(480, root.width * 0.45)

            onNewSecurityRequested: newSecurityWindow.openWindow()
            onNewWatchlistRequested: newWatchlistWindow.openWindow()
            onNewTaxonomyRequested: newTaxonomyWindow.openWindow()
            onNavigationRequested: function(viewType, entityId, title, color) {
                if (viewType === "securityDetail") {
                    root.openSecurity(entityId)
                    return
                }
                root.currentView = viewType
                root.currentEntityId = entityId
                root.currentTitle = title
                root.currentEntityColor = color
            }
        }

        ContentRouter {
            currentView: root.currentView
            currentEntityId: root.currentEntityId
            currentTitle: root.currentTitle
            currentEntityColor: root.currentEntityColor
            securityModel: root.securityModel
            securityTagAssignmentModel: root.securityTagAssignmentModel
            tagTreeModel: root.tagTreeModel
            SplitView.fillWidth: true
            onEditSecurityRequested: function(row) { newSecurityWindow.openForEdit(row) }
            onDeleteSecurityRequested: function(securityId, companyName) {
                deleteSecurityWindow.openForSecurity(securityId, companyName)
            }
            onSecurityActivated: function(securityId) { root.openSecurity(securityId) }
            onAssignTagsRequested: function(securityId) {
                tagAssignmentWindow.openForSecurity(securityId)
            }
            onNewTagRequested: function(taxonomyId, parentTagId, parentName, defaultColor) {
                newTagWindow.openForParent(taxonomyId, parentTagId, parentName, defaultColor)
            }
            onEditTagRequested: function(taxonomyId, tagId, tagName, description, color) {
                newTagWindow.openForEdit(taxonomyId, tagId, tagName, description, color)
            }
            onDeleteTagRequested: function(taxonomyId, tagId, tagName) {
                deleteTagWindow.openForTag(taxonomyId, tagId, tagName)
            }
        }
    }

    Connections {
        target: root.securityModel

        function onSecurityUpdated(securityId) {
            if (root.currentView !== "securityDetail"
                    || root.currentEntityId !== securityId)
                return
            const security = root.securityModel.securityById(securityId)
            if (security.id)
                root.currentTitle = security.symbol + " — " + security.name
        }

        function onSecurityDeleted(securityId) {
            if (root.currentView !== "securityDetail"
                    || root.currentEntityId !== securityId)
                return
            root.currentView = "allSecurities"
            root.currentEntityId = "all"
            root.currentTitle = qsTr("All Securities")
            root.currentEntityColor = ""
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

    NewTagWindow {
        id: newTagWindow
        ownerWindow: root
        tagTreeModel: root.tagTreeModel
    }

    TagAssignmentWindow {
        id: tagAssignmentWindow
        ownerWindow: root
        assignmentModel: root.securityTagAssignmentModel
    }

    DeleteTagWindow {
        id: deleteTagWindow
        ownerWindow: root
        tagTreeModel: root.tagTreeModel
    }

    DeleteSecurityWindow {
        id: deleteSecurityWindow
        ownerWindow: root
        securityModel: root.securityModel
    }
}
