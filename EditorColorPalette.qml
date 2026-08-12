import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Popup {
    id: root

    property string title: ""
    property string clearText: qsTr("Default")
    property var colors: []
    signal colorSelected(string color)

    function popup(anchorItem, offsetX, offsetY) {
        const popupPosition = anchorItem.mapToItem(root.parent,
                                                   offsetX,
                                                   offsetY)
        root.x = popupPosition.x
        root.y = popupPosition.y
        root.open()
    }

    padding: 10
    closePolicy: Popup.CloseOnEscape | Popup.CloseOnPressOutside

    background: Rectangle {
        color: Theme.windowBackground
        border.width: 1
        border.color: Theme.border
        radius: Theme.mediumRadius
    }

    contentItem: ColumnLayout {
        spacing: 8

        Label {
            text: root.title
            color: Theme.textSecondary
            font.pixelSize: 12
            font.weight: Font.DemiBold
        }

        GridLayout {
            columns: 6
            columnSpacing: 6
            rowSpacing: 6

            Repeater {
                model: root.colors

                delegate: Button {
                    id: swatchButton
                    required property string modelData
                    implicitWidth: 26
                    implicitHeight: 26
                    flat: true
                    Accessible.name: modelData
                    onClicked: {
                        root.colorSelected(modelData)
                        root.close()
                    }

                    background: Rectangle {
                        radius: 4
                        color: swatchButton.modelData
                        border.width: swatchButton.hovered ? 2 : 1
                        border.color: swatchButton.hovered ? Theme.accent : Theme.border
                    }
                }
            }
        }

        Button {
            Layout.fillWidth: true
            text: root.clearText
            flat: true
            onClicked: {
                root.colorSelected("")
                root.close()
            }
        }
    }
}
