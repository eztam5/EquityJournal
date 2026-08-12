import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Rectangle {
    id: root

    required property var securityModel
    signal editSecurityRequested(int row)
    signal deleteSecurityRequested(string securityId, string companyName)
    signal securityActivated(string securityId)

    color: Theme.contentBackground

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 40
        spacing: 20

        Label {
            text: qsTr("All Securities")
            color: Theme.textPrimary
            font.pixelSize: 28
            font.weight: Font.DemiBold
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.contentBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius
            clip: true

            ColumnLayout {
                anchors.fill: parent
                spacing: 0

                HorizontalHeaderView {
                    id: headerView
                    Layout.fillWidth: true
                    implicitHeight: 38
                    syncView: tableView
                    clip: true

                    delegate: Rectangle {
                        required property var display

                        implicitHeight: 38
                        color: Theme.sidebarBackground

                        Label {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            text: display
                            color: Theme.textSecondary
                            font.pixelSize: 13
                            font.weight: Font.DemiBold
                            elide: Text.ElideRight
                            verticalAlignment: Text.AlignVCenter
                        }

                        Rectangle {
                            anchors.right: parent.right
                            width: 1
                            height: parent.height
                            color: Theme.border
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: 1
                    color: Theme.border
                }

                TableView {
                    id: tableView
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    model: root.securityModel
                    clip: true
                    boundsBehavior: Flickable.StopAtBounds
                    columnSpacing: 0
                    rowSpacing: 0
                    resizableColumns: true

                    columnWidthProvider: function(column) {
                        const explicitWidth = explicitColumnWidth(column)
                        if (explicitWidth >= 0)
                            return explicitWidth

                        const availableWidth = Math.max(width, 600)
                        if (column === 0)
                            return Math.round(availableWidth * 0.22)
                        if (column === 1)
                            return Math.round(availableWidth * 0.58)
                        return Math.round(availableWidth * 0.20)
                    }

                    delegate: Rectangle {
                        id: cell
                        required property var display
                        required property int row
                        required property int column

                        implicitHeight: 40
                        color: row % 2 === 0 ? Theme.contentBackground : Theme.windowBackground

                        Label {
                            anchors.fill: parent
                            anchors.leftMargin: 12
                            anchors.rightMargin: 12
                            text: display
                            color: Theme.textPrimary
                            font.pixelSize: 14
                            font.weight: column === 0 ? Font.Medium : Font.Normal
                            elide: Text.ElideRight
                            verticalAlignment: Text.AlignVCenter
                        }

                        Rectangle {
                            anchors.right: parent.right
                            width: 1
                            height: parent.height
                            color: Theme.border
                        }

                        Rectangle {
                            anchors.bottom: parent.bottom
                            width: parent.width
                            height: 1
                            color: Theme.border
                        }

                        MouseArea {
                            anchors.fill: parent
                            acceptedButtons: Qt.LeftButton | Qt.RightButton
                            cursorShape: Qt.ArrowCursor

                            onClicked: function(mouse) {
                                if (mouse.button === Qt.RightButton) {
                                    securityContextMenu.securityRow = cell.row
                                    securityContextMenu.popup()
                                }
                            }

                            onDoubleClicked: function(mouse) {
                                if (mouse.button !== Qt.LeftButton)
                                    return
                                const security = root.securityModel.securityAt(cell.row)
                                if (security.id)
                                    root.securityActivated(security.id)
                            }
                        }
                    }
                }
            }

            Label {
                anchors.centerIn: parent
                visible: root.securityModel.count === 0
                text: qsTr("No securities yet")
                color: Theme.textMuted
                font.pixelSize: 14
            }
        }
    }

    Menu {
        id: securityContextMenu
        property int securityRow: -1

        MenuItem {
            text: qsTr("Edit")
            enabled: securityContextMenu.securityRow >= 0
            onTriggered: root.editSecurityRequested(securityContextMenu.securityRow)
        }

        MenuItem {
            text: qsTr("Delete")
            enabled: securityContextMenu.securityRow >= 0
            onTriggered: {
                const security = root.securityModel.securityAt(securityContextMenu.securityRow)
                if (security.id)
                    root.deleteSecurityRequested(security.id, security.name)
            }
        }
    }
}
