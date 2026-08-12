import QtQuick
import QtQuick.Window
import QtQuick.Layouts
import QtQuick.Controls

Window {
    id: root

    required property Window ownerWindow
    required property var assignmentModel
    property string securityId: ""

    width: 540
    height: 650
    minimumWidth: 440
    minimumHeight: 480
    visible: false
    title: qsTr("Assign tags")
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

    function openForSecurity(selectedSecurityId) {
        securityId = selectedSecurityId
        searchField.clear()
        validationMessage.text = ""
        if (!assignmentModel.beginEditing(securityId)) {
            validationMessage.text = assignmentModel.lastError
            return
        }

        if (!visible) {
            x = Math.round(ownerWindow.x + (ownerWindow.width - width) / 2)
            y = Math.round(ownerWindow.y + (ownerWindow.height - height) / 2)
            show()
        }
        raise()
        requestActivate()
        Qt.callLater(function() {
            tree.expandRecursively()
            searchField.forceActiveFocus()
        })
    }

    function cancel() {
        assignmentModel.cancelEditing()
        close()
    }

    function applyChanges() {
        if (assignmentModel.apply()) {
            close()
            return
        }
        validationMessage.text = assignmentModel.lastError
    }

    onClosing: function(close) {
        if (visible)
            assignmentModel.cancelEditing()
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 20
        spacing: 12

        TextField {
            id: searchField
            Layout.fillWidth: true
            placeholderText: qsTr("Search tags or taxonomies")
            selectByMouse: true
            onTextEdited: {
                root.assignmentModel.filterText = text
                Qt.callLater(function() { tree.expandRecursively() })
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.contentBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            TreeView {
                id: tree
                anchors.fill: parent
                anchors.margins: 1
                clip: true
                model: root.assignmentModel
                columnWidthProvider: function() { return width }

                delegate: TreeViewDelegate {
                    id: treeDelegate
                    implicitHeight: 40
                    width: tree.width
                    text: treeDelegate.model.nodeName

                    contentItem: Item {
                        implicitWidth: assignmentCheck.implicitWidth + 8
                                       + colorMarker.implicitWidth + 8
                                       + assignmentLabel.implicitWidth
                        implicitHeight: Math.max(assignmentCheck.implicitHeight,
                                                 assignmentLabel.implicitHeight)

                        CheckBox {
                            id: assignmentCheck
                            anchors.left: parent.left
                            anchors.verticalCenter: parent.verticalCenter
                            visible: !treeDelegate.model.taxonomyRoot
                            checked: treeDelegate.model.checked
                            onClicked: root.assignmentModel.setTagChecked(
                                           treeDelegate.model.nodeId, checked)
                        }

                        Rectangle {
                            id: colorMarker
                            anchors.left: treeDelegate.model.taxonomyRoot
                                          ? parent.left : assignmentCheck.right
                            anchors.leftMargin: treeDelegate.model.taxonomyRoot ? 0 : 8
                            anchors.verticalCenter: parent.verticalCenter
                            implicitWidth: 9
                            implicitHeight: 9
                            radius: 5
                            color: treeDelegate.model.nodeColor
                        }

                        Label {
                            id: assignmentLabel
                            anchors.left: colorMarker.right
                            anchors.leftMargin: 8
                            anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            text: treeDelegate.model.nodeName
                            color: Theme.textPrimary
                            font.weight: treeDelegate.model.taxonomyRoot
                                         ? Font.DemiBold : Font.Normal
                            elide: Text.ElideRight
                        }
                    }
                }
            }
        }

        Label {
            id: validationMessage
            Layout.fillWidth: true
            color: Theme.error
            font.pixelSize: 12
            wrapMode: Text.WordWrap
        }

        RowLayout {
            Layout.fillWidth: true
            spacing: 8
            Item { Layout.fillWidth: true }
            Button { text: qsTr("Cancel"); onClicked: root.cancel() }
            Button { text: qsTr("Apply"); onClicked: root.applyChanges() }
        }
    }
}
