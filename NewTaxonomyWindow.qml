import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root

    required property Window ownerWindow
    required property var taxonomyModel

    property string selectedColor: "#4F7CAC"
    readonly property var availableColors: [
        "#4F7CAC", "#2E8B78", "#7A5AF8", "#C47F17",
        "#C25555", "#9B5C8F", "#667085", "#3478C9"
    ]

    width: 480
    height: 390
    minimumWidth: 420
    minimumHeight: 360
    visible: false
    title: qsTr("New taxonomy")
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
        nameField.clear()
        descriptionField.clear()
        selectedColor = availableColors[0]
        validationMessage.text = ""

        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }

        raise()
        requestActivate()
        Qt.callLater(function() { nameField.forceActiveFocus() })
    }

    function submit() {
        if (taxonomyModel.addTaxonomy(nameField.text,
                                      descriptionField.text,
                                      selectedColor)) {
            close()
            return
        }

        validationMessage.text = taxonomyModel.lastError
        nameField.forceActiveFocus()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 8

        Label {
            text: qsTr("Name")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        TextField {
            id: nameField
            Layout.fillWidth: true
            placeholderText: qsTr("For example, Investment Thesis")
            selectByMouse: true
            maximumLength: 80
            onTextEdited: validationMessage.text = ""
            onAccepted: descriptionField.forceActiveFocus()
        }

        Label {
            Layout.topMargin: 4
            text: qsTr("Description (optional)")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        ScrollView {
            Layout.fillWidth: true
            Layout.preferredHeight: 96

            TextArea {
                id: descriptionField
                placeholderText: qsTr("Describe the purpose of this taxonomy")
                selectByMouse: true
                wrapMode: TextEdit.Wrap
                onTextChanged: validationMessage.text = ""
            }
        }

        Label {
            Layout.topMargin: 4
            text: qsTr("Color")
            color: Theme.textSecondary
            font.pixelSize: 13
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 8

            Repeater {
                model: root.availableColors

                delegate: Button {
                    id: colorButton
                    required property string modelData

                    implicitWidth: 32
                    implicitHeight: 32
                    flat: true
                    Accessible.name: qsTr("Select color %1").arg(modelData)
                    onClicked: root.selectedColor = modelData

                    background: Rectangle {
                        radius: width / 2
                        color: colorButton.modelData
                        border.width: root.selectedColor === colorButton.modelData ? 3 : 1
                        border.color: root.selectedColor === colorButton.modelData
                                      ? Theme.textPrimary : Theme.border
                    }
                }
            }

            Item {
                Layout.fillWidth: true
            }
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
                enabled: nameField.text.trim().length > 0
                onClicked: root.submit()
            }
        }
    }
}
