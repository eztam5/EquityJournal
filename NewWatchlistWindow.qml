import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root

    required property Window ownerWindow
    required property var watchlistModel

    width: 420
    height: 210
    minimumWidth: 360
    minimumHeight: 190
    visible: false
    title: qsTr("New watchlist")
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
    palette.placeholderText: Theme.textMuted

    function openWindow() {
        if (!visible) {
            nameField.clear()
            validationMessage.text = ""
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }

        raise()
        requestActivate()
        Qt.callLater(function() { nameField.forceActiveFocus() })
    }

    function submit() {
        if (watchlistModel.addWatchlist(nameField.text)) {
            close()
            return
        }

        validationMessage.text = watchlistModel.lastError
        nameField.forceActiveFocus()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 8

        Label {
            text: qsTr("List name")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        TextField {
            id: nameField
            Layout.fillWidth: true
            placeholderText: qsTr("For example, Watchlist")
            selectByMouse: true
            maximumLength: 80
            onTextEdited: validationMessage.text = ""
            onAccepted: root.submit()
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
                text: qsTr("Cancel")
                onClicked: root.close()
            }

            Button {
                text: qsTr("OK")
                enabled: nameField.text.trim().length > 0
                onClicked: root.submit()
            }
        }
    }
}
