import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root
    required property Window ownerWindow
    required property var noteModel
    property var textDocument: null
    property int selectionStart: 0
    property int selectionEnd: 0

    width: 460
    height: 250
    minimumWidth: 400
    minimumHeight: 230
    visible: false
    title: qsTr("Insert link")
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

    function openForSelection(document, start, end, selectedText) {
        textDocument = document
        selectionStart = start
        selectionEnd = end
        urlField.clear()
        labelField.text = selectedText
        labelField.enabled = selectedText.length === 0
        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }
        raise()
        requestActivate()
        Qt.callLater(function() { urlField.forceActiveFocus() })
    }

    function submit() {
        noteModel.insertLink(textDocument, selectionStart, selectionEnd,
                             urlField.text, labelField.text)
        close()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 8
        Label { text: qsTr("URL"); color: Theme.textSecondary }
        TextField {
            id: urlField
            Layout.fillWidth: true
            placeholderText: qsTr("https://example.com")
            selectByMouse: true
            onAccepted: labelField.enabled ? labelField.forceActiveFocus() : root.submit()
        }
        Label { text: qsTr("Link text"); color: Theme.textSecondary }
        TextField {
            id: labelField
            Layout.fillWidth: true
            placeholderText: qsTr("Displayed text")
            selectByMouse: true
            onAccepted: root.submit()
        }
        Item { Layout.fillHeight: true }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            Button { text: qsTr("Cancel"); onClicked: root.close() }
            Button {
                text: qsTr("Insert")
                enabled: urlField.text.trim().length > 0
                onClicked: root.submit()
            }
        }
    }
}
