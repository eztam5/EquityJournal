import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root

    required property Window ownerWindow
    required property var securityModel
    property string securityId: ""
    property string companyName: ""

    width: 460
    height: 190
    minimumWidth: 400
    minimumHeight: 170
    visible: false
    title: qsTr("Delete security")
    flags: Qt.Dialog | Qt.WindowTitleHint | Qt.WindowCloseButtonHint
    modality: Qt.NonModal
    transientParent: ownerWindow
    color: Theme.windowBackground
    palette.window: Theme.windowBackground
    palette.windowText: Theme.textPrimary
    palette.base: Theme.contentBackground
    palette.text: Theme.textPrimary
    palette.button: Theme.selected
    palette.buttonText: Theme.textPrimary
    palette.highlight: Theme.accent
    palette.highlightedText: Theme.accentText

    function openForSecurity(id, name) {
        securityId = id
        companyName = name
        validationMessage.text = ""

        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }

        raise()
        requestActivate()
    }

    function confirmDeletion() {
        if (securityModel.deleteSecurity(securityId)) {
            close()
            return
        }

        validationMessage.text = securityModel.lastError
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 12

        Label {
            Layout.fillWidth: true
            text: qsTr("Do you really want to delete %1?").arg(root.companyName)
            color: Theme.textPrimary
            font.pixelSize: 14
            wrapMode: Text.WordWrap
        }

        Label {
            id: validationMessage
            Layout.fillWidth: true
            color: Theme.error
            font.pixelSize: 12
            wrapMode: Text.WordWrap
        }

        Item {
            Layout.fillHeight: true
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Item {
                Layout.fillWidth: true
            }

            Button {
                text: qsTr("No")
                onClicked: root.close()
            }

            Button {
                text: qsTr("Yes")
                onClicked: root.confirmDeletion()
            }
        }
    }
}
