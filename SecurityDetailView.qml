import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Rectangle {
    id: root

    required property string securityId
    required property var securityModel
    property var security: ({})

    color: Theme.contentBackground

    function loadSecurity() {
        security = securityModel.securityById(securityId)
    }

    Component.onCompleted: loadSecurity()
    onSecurityIdChanged: loadSecurity()

    Connections {
        target: root.securityModel

        function onSecurityUpdated(updatedSecurityId) {
            if (updatedSecurityId === root.securityId)
                root.loadSecurity()
        }
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 40
        spacing: 24

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4

            Label {
                text: root.security.symbol || ""
                color: Theme.textPrimary
                font.pixelSize: 30
                font.weight: Font.DemiBold
            }

            Label {
                text: root.security.name || ""
                color: Theme.textSecondary
                font.pixelSize: 18
            }
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 104
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            RowLayout {
                anchors.fill: parent
                anchors.margins: 20
                spacing: 48

                ColumnLayout {
                    spacing: 6

                    Label {
                        text: qsTr("Symbol")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        text: root.security.symbol || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                    }
                }

                ColumnLayout {
                    spacing: 6

                    Label {
                        text: qsTr("Currency")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        text: root.security.currency || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 6

                    Label {
                        text: qsTr("Company name")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        Layout.fillWidth: true
                        text: root.security.name || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                        elide: Text.ElideRight
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            Label {
                anchors.centerIn: parent
                text: qsTr("Price charts and research notes will appear here.")
                color: Theme.textMuted
                font.pixelSize: 14
            }
        }
    }
}
