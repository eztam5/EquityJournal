import QtQuick
import QtQuick.Controls

Button {
    id: control

    required property string label
    property bool selected: false
    property color markerColor: "transparent"

    implicitHeight: Theme.navigationItemHeight
    flat: true
    hoverEnabled: true
    Accessible.name: label

    contentItem: Text {
        leftPadding: control.markerColor.a > 0 ? 28 : 12
        rightPadding: 8
        text: control.label
        color: control.selected ? Theme.textPrimary : Theme.textSecondary
        font.pixelSize: 14
        font.weight: control.selected ? Font.Medium : Font.Normal
        elide: Text.ElideRight
        horizontalAlignment: Text.AlignLeft
        verticalAlignment: Text.AlignVCenter
    }

    background: Rectangle {
        radius: Theme.mediumRadius
        color: control.down ? Theme.pressed
                            : control.hovered ? Theme.hover
                                              : control.selected ? Theme.selected : "transparent"
    }


    Rectangle {
        visible: control.markerColor.a > 0
        anchors.left: parent.left
        anchors.leftMargin: 12
        anchors.verticalCenter: parent.verticalCenter
        width: 8
        height: 8
        radius: 4
        color: control.markerColor
    }
}
