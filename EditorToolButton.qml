import QtQuick
import QtQuick.Controls

ToolButton {
    id: control

    property string displayText: ""
    property string tooltipText: action ? action.text : ""
    property url iconSource: ""
    property color indicatorColor: "transparent"

    implicitWidth: 32
    implicitHeight: 30
    focusPolicy: Qt.TabFocus
    hoverEnabled: true
    display: iconSource.toString().length > 0
             ? AbstractButton.IconOnly : AbstractButton.TextOnly
    text: displayText.length > 0 ? displayText : (action ? action.text : "")
    icon.source: iconSource
    icon.width: 17
    icon.height: 17
    icon.color: control.enabled ? Theme.textPrimary : Theme.textMuted
    palette.buttonText: control.enabled ? Theme.textPrimary : Theme.textMuted

    ToolTip.visible: hovered && tooltipText.length > 0
    ToolTip.text: tooltipText
    ToolTip.delay: 450

    background: Rectangle {
        radius: 4
        color: control.down ? Theme.pressed
                            : control.checked ? Theme.selected
                            : control.hovered ? Theme.hover : "transparent"
        border.width: control.visualFocus ? 1 : 0
        border.color: Theme.accent
    }

    Rectangle {
        visible: control.indicatorColor.a > 0
        anchors.horizontalCenter: parent.horizontalCenter
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 3
        width: 17
        height: 3
        radius: 1
        color: control.indicatorColor
    }
}
