import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Rectangle {
    id: root

    required property var watchlistModel
    required property var taxonomyModel
    required property var recentSecuritiesModel
    property string currentView: "allSecurities"
    property string currentEntityId: "all"

    signal newSecurityRequested()
    signal newWatchlistRequested()
    signal newTaxonomyRequested()
    signal navigationRequested(string viewType, string entityId, string title, string color)

    color: Theme.sidebarBackground

    Rectangle {
        anchors.right: parent.right
        width: 1
        height: parent.height
        color: Theme.border
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.topMargin: 26
        anchors.leftMargin: Theme.sidebarPadding
        anchors.rightMargin: Theme.sidebarPadding
        anchors.bottomMargin: Theme.sidebarPadding
        spacing: 6

        SidebarSectionHeader {
            title: qsTr("Securities")
            addMenu: securitiesAddMenu
        }

        NavigationItem {
            Layout.fillWidth: true
            label: qsTr("All Securities")
            selected: root.currentView === "allSecurities"
            onClicked: root.navigationRequested("allSecurities", "all", label, "")
        }

        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 240)
            Layout.maximumHeight: 240
            clip: true
            spacing: 3
            model: root.watchlistModel

            delegate: NavigationItem {
                required property string watchlistId
                required property string name

                width: ListView.view.width
                label: name
                selected: root.currentView === "watchlist"
                          && root.currentEntityId === watchlistId
                onClicked: root.navigationRequested("watchlist", watchlistId, name, "")
            }
        }

        SidebarSectionHeader {
            Layout.topMargin: 14
            title: qsTr("Taxonomies")
            onAddRequested: root.newTaxonomyRequested()
        }

        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 240)
            Layout.maximumHeight: 240
            clip: true
            spacing: 3
            model: root.taxonomyModel

            delegate: NavigationItem {
                required property string taxonomyId
                required property string name
                required property string taxonomyColor

                width: ListView.view.width
                label: name
                markerColor: taxonomyColor
                selected: root.currentView === "taxonomy"
                          && root.currentEntityId === taxonomyId
                onClicked: root.navigationRequested("taxonomy", taxonomyId, name, taxonomyColor)
            }
        }

        SidebarSectionHeader {
            Layout.topMargin: 14
            visible: root.recentSecuritiesModel.count > 0
            title: qsTr("Recently Viewed")
            showAddButton: false
        }

        ListView {
            Layout.fillWidth: true
            Layout.preferredHeight: Math.min(contentHeight, 210)
            Layout.maximumHeight: 210
            visible: root.recentSecuritiesModel.count > 0
            clip: true
            spacing: 3
            model: root.recentSecuritiesModel

            delegate: NavigationItem {
                required property string securityId
                required property string name
                required property string symbol

                width: ListView.view.width
                label: symbol + " — " + name
                selected: root.currentView === "securityDetail"
                          && root.currentEntityId === securityId
                onClicked: root.navigationRequested("securityDetail",
                                                     securityId,
                                                     label,
                                                     "")
            }
        }

        Item {
            Layout.fillHeight: true
        }
    }

    Menu {
        id: securitiesAddMenu

        MenuItem {
            text: qsTr("New security")
            onTriggered: root.newSecurityRequested()
        }

        MenuItem {
            text: qsTr("New watchlist")
            onTriggered: root.newWatchlistRequested()
        }
    }
}
