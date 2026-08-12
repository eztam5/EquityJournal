import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Rectangle {
    id: root

    required property string securityId
    required property var securityModel
    required property var assignmentModel
    property var security: ({})
    signal assignTagsRequested(string securityId)

    color: Theme.contentBackground

    function loadSecurity() {
        security = securityModel.securityById(securityId)
        assignmentModel.loadSecurity(securityId)
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
            implicitHeight: classificationContent.implicitHeight + 40
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            ColumnLayout {
                id: classificationContent
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: 20
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    Label {
                        Layout.fillWidth: true
                        text: qsTr("Classification")
                        color: Theme.textPrimary
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                    }
                    Button {
                        text: qsTr("Add tags")
                        onClicked: root.assignTagsRequested(root.securityId)
                    }
                }

                Label {
                    visible: root.assignmentModel.assignedCount === 0
                    text: qsTr("No tags assigned yet")
                    color: Theme.textMuted
                    font.pixelSize: 13
                }

                Repeater {
                    model: root.assignmentModel.assignedGroups

                    delegate: ColumnLayout {
                        id: groupDelegate
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 7

                        Label {
                            text: parent.modelData.taxonomyName
                            color: Theme.textSecondary
                            font.pixelSize: 13
                            font.weight: Font.Medium
                        }

                        Flow {
                            Layout.fillWidth: true
                            spacing: 8

                            Repeater {
                                model: groupDelegate.modelData.tags

                                delegate: Button {
                                    id: tagChip
                                    required property var modelData
                                    text: modelData.name + "  ×"
                                    flat: true
                                    onClicked: root.assignmentModel.removeAssignedTag(
                                                   root.securityId, modelData.id)

                                    background: Rectangle {
                                        radius: Theme.mediumRadius
                                        color: Theme.selected
                                        border.width: 1
                                        border.color: tagChip.modelData.color
                                    }
                                }
                            }
                        }
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
