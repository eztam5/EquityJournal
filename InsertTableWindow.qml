import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root
    required property Window ownerWindow
    required property var noteModel
    property var textDocument: null
    property int cursorPosition: 0

    width: 400
    height: 220
    minimumWidth: 360
    minimumHeight: 200
    visible: false
    title: qsTr("Insert table")
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

    function openAtCursor(document, position) {
        textDocument = document
        cursorPosition = position
        rowsBox.value = 3
        columnsBox.value = 3
        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }
        raise()
        requestActivate()
    }

    function submit() {
        noteModel.insertTable(textDocument, cursorPosition,
                              rowsBox.value, columnsBox.value)
        close()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 12
        RowLayout {
            Layout.fillWidth: true
            Label { Layout.fillWidth: true; text: qsTr("Rows"); color: Theme.textSecondary }
            SpinBox { id: rowsBox; from: 1; to: 20; editable: true }
        }
        RowLayout {
            Layout.fillWidth: true
            Label { Layout.fillWidth: true; text: qsTr("Columns"); color: Theme.textSecondary }
            SpinBox { id: columnsBox; from: 1; to: 10; editable: true }
        }
        Item { Layout.fillHeight: true }
        RowLayout {
            Layout.fillWidth: true
            Item { Layout.fillWidth: true }
            Button { text: qsTr("Cancel"); onClicked: root.close() }
            Button { text: qsTr("Insert"); onClicked: root.submit() }
        }
    }
}
