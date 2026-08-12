import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import QtQml.Models

Rectangle {
    id: root

    required property string taxonomyId
    required property string taxonomyName
    required property string taxonomyColor
    required property var tagTreeModel

    signal newTagRequested(string taxonomyId,
                           string parentTagId,
                           string parentName,
                           string defaultColor)
    signal editTagRequested(string taxonomyId,
                            string tagId,
                            string tagName,
                            string description,
                            string color)
    signal deleteTagRequested(string taxonomyId, string tagId, string tagName)

    color: Theme.contentBackground

    function loadTaxonomy() {
        if (taxonomyId.length === 0)
            return

        tagTreeModel.loadTaxonomy(taxonomyId, taxonomyName, taxonomyColor)
        Qt.callLater(function() {
            tree.expand(0)
            tree.selectionModel.setCurrentIndex(
                tree.index(0, 0), ItemSelectionModel.ClearAndSelect)
        })
    }

    Component.onCompleted: loadTaxonomy()
    onTaxonomyIdChanged: loadTaxonomy()
    onTaxonomyNameChanged: loadTaxonomy()
    onTaxonomyColorChanged: loadTaxonomy()

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 32
        spacing: 18

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 3

            Label {
                text: root.taxonomyName
                color: Theme.textPrimary
                font.pixelSize: 28
                font.weight: Font.DemiBold
            }

            Label {
                text: qsTr("Right-click the taxonomy or a tag to manage its tree.")
                color: Theme.textMuted
                font.pixelSize: 13
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            TreeView {
                id: tree

                anchors.fill: parent
                anchors.margins: 1
                clip: true
                model: root.tagTreeModel
                selectionModel: ItemSelectionModel {}
                selectionBehavior: TableView.SelectRows
                selectionMode: TableView.SingleSelection
                columnWidthProvider: function() { return width }

                delegate: TreeViewDelegate {
                    id: treeDelegate

                    implicitHeight: 40
                    width: tree.width
                    text: treeDelegate.model.tagName

                    contentItem: Item {
                        implicitWidth: colorMarker.implicitWidth + 9 + tagLabel.implicitWidth
                        implicitHeight: Math.max(colorMarker.implicitHeight,
                                                 tagLabel.implicitHeight)

                        Rectangle {
                            id: colorMarker

                            anchors.left: parent.left
                            anchors.verticalCenter: parent.verticalCenter
                            implicitWidth: 10
                            implicitHeight: 10
                            radius: 5
                            color: treeDelegate.model.tagColor
                        }

                        Label {
                            id: tagLabel

                            anchors.left: colorMarker.right
                            anchors.leftMargin: 9
                            anchors.right: parent.right
                            anchors.verticalCenter: parent.verticalCenter
                            text: treeDelegate.model.tagName
                            color: treeDelegate.highlighted
                                   ? treeDelegate.palette.highlightedText
                                   : Theme.textPrimary
                            elide: Text.ElideRight
                            font.weight: treeDelegate.model.taxonomyRoot
                                         ? Font.DemiBold : Font.Normal
                        }
                    }

                    onClicked: {
                        tree.selectionModel.setCurrentIndex(
                            tree.index(row, 0), ItemSelectionModel.ClearAndSelect)
                    }

                    MouseArea {
                        anchors.fill: parent
                        acceptedButtons: Qt.RightButton
                        onClicked: function(mouse) {
                            tree.selectionModel.setCurrentIndex(
                                tree.index(treeDelegate.row, 0),
                                ItemSelectionModel.ClearAndSelect)
                            tagContextMenu.tagId = treeDelegate.model.tagId
                            tagContextMenu.tagName = treeDelegate.model.tagName
                            tagContextMenu.tagDescription = treeDelegate.model.description
                            tagContextMenu.tagColor = treeDelegate.model.tagColor
                            tagContextMenu.taxonomyRoot = treeDelegate.model.taxonomyRoot
                            tagContextMenu.popup()
                        }
                    }
                }
            }

            Label {
                anchors.centerIn: parent
                width: Math.min(parent.width - 48, 430)
                visible: root.tagTreeModel.tagCount === 0
                text: qsTr("This taxonomy has no tags yet. Select its root and add the first tag.")
                color: Theme.textMuted
                horizontalAlignment: Text.AlignHCenter
                wrapMode: Text.WordWrap
            }
        }
    }

    Menu {
        id: tagContextMenu

        property string tagId: ""
        property string tagName: ""
        property string tagDescription: ""
        property string tagColor: ""
        property bool taxonomyRoot: false

        MenuItem {
            text: qsTr("Add Tag")
            onTriggered: root.newTagRequested(root.taxonomyId,
                                              tagContextMenu.tagId,
                                              tagContextMenu.tagName,
                                              tagContextMenu.tagColor)
        }

        MenuItem {
            text: qsTr("Edit Tag")
            enabled: !tagContextMenu.taxonomyRoot
            onTriggered: root.editTagRequested(root.taxonomyId,
                                               tagContextMenu.tagId,
                                               tagContextMenu.tagName,
                                               tagContextMenu.tagDescription,
                                               tagContextMenu.tagColor)
        }

        MenuItem {
            text: qsTr("Delete Tag")
            enabled: !tagContextMenu.taxonomyRoot
            onTriggered: root.deleteTagRequested(root.taxonomyId,
                                                 tagContextMenu.tagId,
                                                 tagContextMenu.tagName)
        }
    }
}
