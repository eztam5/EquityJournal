import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root

    required property Window ownerWindow
    required property var securityModel
    property string editingSecurityId: ""
    readonly property bool editing: editingSecurityId.length > 0

    width: 460
    height: 350
    minimumWidth: 400
    minimumHeight: 320
    visible: false
    title: editing ? qsTr("Edit security") : qsTr("New security")
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
        editingSecurityId = ""
        symbolField.clear()
        currencyField.clear()
        companyNameField.clear()
        validationMessage.text = ""
        showAndActivate()
    }

    function openForEdit(row) {
        const security = securityModel.securityAt(row)
        if (!security.id)
            return

        editingSecurityId = security.id
        symbolField.text = security.symbol
        currencyField.text = security.currency
        companyNameField.text = security.name
        validationMessage.text = ""
        showAndActivate()
    }

    function showAndActivate() {
        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }

        raise()
        requestActivate()
        Qt.callLater(function() { symbolField.forceActiveFocus() })
    }

    function clearValidation() {
        validationMessage.text = ""
    }

    function submit() {
        const saved = editing
            ? securityModel.updateSecurity(editingSecurityId,
                                           symbolField.text,
                                           currencyField.text,
                                           companyNameField.text)
            : securityModel.addSecurity(symbolField.text,
                                        currencyField.text,
                                        companyNameField.text)
        if (saved) {
            close()
            return
        }

        validationMessage.text = securityModel.lastError
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 8

        Label {
            text: qsTr("Symbol")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        TextField {
            id: symbolField
            Layout.fillWidth: true
            placeholderText: qsTr("For example, AAPL")
            selectByMouse: true
            maximumLength: 20
            onTextEdited: root.clearValidation()
            onAccepted: currencyField.forceActiveFocus()
        }

        Label {
            text: qsTr("Currency")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        TextField {
            id: currencyField
            Layout.fillWidth: true
            placeholderText: qsTr("For example, USD")
            selectByMouse: true
            maximumLength: 3
            onTextEdited: root.clearValidation()
            onAccepted: companyNameField.forceActiveFocus()
        }

        Label {
            text: qsTr("Company name")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        TextField {
            id: companyNameField
            Layout.fillWidth: true
            placeholderText: qsTr("For example, Apple Inc.")
            selectByMouse: true
            maximumLength: 120
            onTextEdited: root.clearValidation()
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
                text: qsTr("Save")
                enabled: symbolField.text.trim().length > 0
                         && currencyField.text.trim().length > 0
                         && companyNameField.text.trim().length > 0
                onClicked: root.submit()
            }
        }
    }
}
