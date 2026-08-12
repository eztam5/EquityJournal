import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

RowLayout {
    id: root

    required property string title
    property var addMenu: null
    signal addRequested()

    Layout.fillWidth: true
    Layout.leftMargin: 8
    Layout.rightMargin: 2
    Layout.bottomMargin: 4

    Label {
        text: root.title
        color: Theme.textMuted
        font.pixelSize: 13
        font.weight: Font.DemiBold
        Layout.fillWidth: true
    }

    Button {
        id: addButton
        implicitWidth: 30
        implicitHeight: 30
        flat: true
        hoverEnabled: true
        Accessible.name: qsTr("Add to %1").arg(root.title)
        ToolTip.visible: hovered
        ToolTip.text: qsTr("Add")

        contentItem: Text {
            text: "+"
            color: addButton.down ? Theme.accent : Theme.textSecondary
            font.pixelSize: 22
            font.weight: Font.Light
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
        }

        background: Rectangle {
            radius: Theme.smallRadius
            color: addButton.down ? Theme.pressed
                                  : addButton.hovered ? Theme.hover : "transparent"
        }

        onClicked: {
            if (root.addMenu)
                root.addMenu.popup(addButton, 0, addButton.height)
            else
                root.addRequested()
        }
    }
}
