import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

Rectangle {
    id: root

    required property string securityId
    required property var securityModel
    required property var assignmentModel
    required property var noteModel
    property var security: ({})
    property string editorSecurityId: ""
    property bool loadingNote: false
    property string noteSaveError: ""
    signal assignTagsRequested(string securityId)
    signal insertLinkRequested(var textDocument, int start, int end, string selectedText)
    signal insertTableRequested(var textDocument, int cursorPosition)

    color: Theme.contentBackground

    function loadSecurity() {
        if (noteEditor.textDocument.modified && editorSecurityId.length > 0)
            saveNote(editorSecurityId)
        security = securityModel.securityById(securityId)
        assignmentModel.loadSecurity(securityId)
        loadingNote = true
        if (noteModel.loadSecurity(securityId)) {
            noteEditor.text = noteModel.contentHtml
            editorSecurityId = securityId
            noteSaveError = ""
        }
        Qt.callLater(function() {
            noteEditor.textDocument.modified = false
            loadingNote = false
        })
    }

    function saveNote(targetSecurityId) {
        saveTimer.stop()
        if (!noteModel.saveDocument(targetSecurityId, noteEditor.textDocument)) {
            noteSaveError = noteModel.lastError
            return
        }
        noteSaveError = ""
    }

    Component.onCompleted: loadSecurity()
    onSecurityIdChanged: loadSecurity()

    Connections {
        target: root.securityModel

        function onSecurityUpdated(updatedSecurityId) {
            if (updatedSecurityId === root.securityId)
                root.loadSecurity()
        }
    }

    Timer {
        id: saveTimer
        interval: 1200
        repeat: false
        onTriggered: root.saveNote(root.editorSecurityId)
    }

    ColumnLayout {
        anchors.fill: parent
        anchors.margins: 40
        spacing: 24

        ColumnLayout {
            Layout.fillWidth: true
            spacing: 4

            Label {
                text: root.security.symbol || ""
                color: Theme.textPrimary
                font.pixelSize: 30
                font.weight: Font.DemiBold
            }

            Label {
                text: root.security.name || ""
                color: Theme.textSecondary
                font.pixelSize: 18
            }
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: 104
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            RowLayout {
                anchors.fill: parent
                anchors.margins: 20
                spacing: 48

                ColumnLayout {
                    spacing: 6

                    Label {
                        text: qsTr("Symbol")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        text: root.security.symbol || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                    }
                }

                ColumnLayout {
                    spacing: 6

                    Label {
                        text: qsTr("Currency")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        text: root.security.currency || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                    }
                }

                ColumnLayout {
                    Layout.fillWidth: true
                    spacing: 6

                    Label {
                        text: qsTr("Company name")
                        color: Theme.textMuted
                        font.pixelSize: 12
                    }

                    Label {
                        Layout.fillWidth: true
                        text: root.security.name || ""
                        color: Theme.textPrimary
                        font.pixelSize: 15
                        font.weight: Font.Medium
                        elide: Text.ElideRight
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            implicitHeight: classificationContent.implicitHeight + 40
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            ColumnLayout {
                id: classificationContent
                anchors.left: parent.left
                anchors.right: parent.right
                anchors.top: parent.top
                anchors.margins: 20
                spacing: 12

                RowLayout {
                    Layout.fillWidth: true
                    Label {
                        Layout.fillWidth: true
                        text: qsTr("Classification")
                        color: Theme.textPrimary
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                    }
                    Button {
                        text: qsTr("Add tags")
                        onClicked: root.assignTagsRequested(root.securityId)
                    }
                }

                Label {
                    visible: root.assignmentModel.assignedCount === 0
                    text: qsTr("No tags assigned yet")
                    color: Theme.textMuted
                    font.pixelSize: 13
                }

                Repeater {
                    model: root.assignmentModel.assignedGroups

                    delegate: ColumnLayout {
                        id: groupDelegate
                        required property var modelData
                        Layout.fillWidth: true
                        spacing: 7

                        Label {
                            text: parent.modelData.taxonomyName
                            color: Theme.textSecondary
                            font.pixelSize: 13
                            font.weight: Font.Medium
                        }

                        Flow {
                            Layout.fillWidth: true
                            spacing: 8

                            Repeater {
                                model: groupDelegate.modelData.tags

                                delegate: Button {
                                    id: tagChip
                                    required property var modelData
                                    text: modelData.name + "  ×"
                                    flat: true
                                    onClicked: root.assignmentModel.removeAssignedTag(
                                                   root.securityId, modelData.id)

                                    background: Rectangle {
                                        radius: Theme.mediumRadius
                                        color: Theme.selected
                                        border.width: 1
                                        border.color: tagChip.modelData.color
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: Theme.windowBackground
            border.width: 1
            border.color: Theme.border
            radius: Theme.mediumRadius

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 8

                RowLayout {
                    Layout.fillWidth: true

                    Label {
                        Layout.fillWidth: true
                        text: qsTr("Research Notes")
                        color: Theme.textPrimary
                        font.pixelSize: 18
                        font.weight: Font.DemiBold
                    }

                    Label {
                        id: noteStatus
                        text: root.noteSaveError.length > 0 ? root.noteSaveError
                              : noteEditor.textDocument.modified
                              ? qsTr("Unsaved changes")
                              : noteModel.updatedAt.length > 0 ? qsTr("Saved") : ""
                        color: root.noteSaveError.length > 0 ? Theme.error
                               : noteEditor.textDocument.modified
                               ? Theme.textMuted : Theme.textSecondary
                        font.pixelSize: 12
                    }

                    Button {
                        text: qsTr("Save")
                        enabled: noteEditor.textDocument.modified
                        onClicked: root.saveNote(root.editorSecurityId)
                    }
                }

                Flow {
                    Layout.fillWidth: true
                    Layout.preferredHeight: childrenRect.height
                    spacing: 4

                    ComboBox {
                        width: 130
                        model: [qsTr("Paragraph"), qsTr("Heading 1"), qsTr("Heading 2")]
                        onActivated: noteModel.setParagraphStyle(
                                         noteEditor.textDocument,
                                         noteEditor.selectionStart,
                                         noteEditor.selectionEnd,
                                         currentIndex)
                    }
                    Button {
                        text: "B"
                        font.bold: true
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Bold")
                        onClicked: noteModel.toggleBold(noteEditor.textDocument,
                                                       noteEditor.selectionStart,
                                                       noteEditor.selectionEnd)
                    }
                    Button {
                        text: "I"
                        font.italic: true
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Italic")
                        onClicked: noteModel.toggleItalic(noteEditor.textDocument,
                                                         noteEditor.selectionStart,
                                                         noteEditor.selectionEnd)
                    }
                    Button {
                        text: "U"
                        font.underline: true
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Underline")
                        onClicked: noteModel.toggleUnderline(noteEditor.textDocument,
                                                            noteEditor.selectionStart,
                                                            noteEditor.selectionEnd)
                    }
                    Button {
                        text: "S"
                        font.strikeout: true
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Strikethrough")
                        onClicked: noteModel.toggleStrikethrough(
                                       noteEditor.textDocument,
                                       noteEditor.selectionStart,
                                       noteEditor.selectionEnd)
                    }
                    Button {
                        text: "•"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Bulleted list")
                        onClicked: noteModel.toggleBulletList(noteEditor.textDocument,
                                                             noteEditor.selectionStart,
                                                             noteEditor.selectionEnd)
                    }
                    Button {
                        text: "1."
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Numbered list")
                        onClicked: noteModel.toggleNumberedList(
                                       noteEditor.textDocument,
                                       noteEditor.selectionStart,
                                       noteEditor.selectionEnd)
                    }
                    Button {
                        text: "←"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Decrease indentation")
                        onClicked: noteModel.changeIndent(noteEditor.textDocument,
                                                        noteEditor.selectionStart,
                                                        noteEditor.selectionEnd, -1)
                    }
                    Button {
                        text: "→"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Increase indentation")
                        onClicked: noteModel.changeIndent(noteEditor.textDocument,
                                                        noteEditor.selectionStart,
                                                        noteEditor.selectionEnd, 1)
                    }
                    Button {
                        id: textColorButton
                        text: "A"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Text color")
                        onClicked: textColorMenu.popup(textColorButton, 0, height)
                    }
                    Button {
                        id: backgroundColorButton
                        text: "▨"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Background color")
                        onClicked: backgroundColorMenu.popup(backgroundColorButton, 0, height)
                    }
                    Button {
                        text: "🔗"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Insert link")
                        onClicked: root.insertLinkRequested(noteEditor.textDocument,
                                                           noteEditor.selectionStart,
                                                           noteEditor.selectionEnd,
                                                           noteEditor.selectedText)
                    }
                    Button {
                        text: "▦"
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Insert table")
                        onClicked: root.insertTableRequested(noteEditor.textDocument,
                                                            noteEditor.cursorPosition)
                    }
                    Rectangle { implicitWidth: 1; implicitHeight: 26; color: Theme.border }
                    Button {
                        text: "↶"
                        enabled: noteEditor.canUndo
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Undo")
                        onClicked: noteEditor.undo()
                    }
                    Button {
                        text: "↷"
                        enabled: noteEditor.canRedo
                        ToolTip.visible: hovered
                        ToolTip.text: qsTr("Redo")
                        onClicked: noteEditor.redo()
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: Theme.contentBackground
                    border.width: 1
                    border.color: noteEditor.activeFocus ? Theme.accent : Theme.border
                    radius: Theme.smallRadius

                    ScrollView {
                        anchors.fill: parent
                        anchors.margins: 1

                        TextArea {
                            id: noteEditor
                            textFormat: TextEdit.RichText
                            wrapMode: TextEdit.Wrap
                            selectByMouse: true
                            placeholderText: qsTr("Write your investment thesis, observations, and open questions…")
                            color: Theme.textPrimary
                            onTextChanged: {
                                if (!root.loadingNote && root.editorSecurityId.length > 0)
                                    saveTimer.restart()
                            }

                            TapHandler {
                                acceptedButtons: Qt.RightButton
                                onTapped: function(eventPoint, button) {
                                    const localPosition = eventPoint.position
                                    const documentPosition = noteEditor.positionAt(
                                        localPosition.x, localPosition.y)
                                    if (!root.noteModel.isPositionInTable(
                                            noteEditor.textDocument, documentPosition))
                                        return

                                    tableContextMenu.documentPosition = documentPosition
                                    tableContextMenu.popup(noteEditor,
                                                           localPosition.x,
                                                           localPosition.y)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Menu {
        id: textColorMenu
        MenuItem { text: qsTr("Default"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "") }
        MenuItem { text: qsTr("Red"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#C25555") }
        MenuItem { text: qsTr("Orange"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#C47F17") }
        MenuItem { text: qsTr("Green"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#2E8B78") }
        MenuItem { text: qsTr("Blue"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#3478C9") }
        MenuItem { text: qsTr("Purple"); onTriggered: root.noteModel.setTextColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#7A5AF8") }
    }

    Menu {
        id: backgroundColorMenu
        MenuItem { text: qsTr("None"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "") }
        MenuItem { text: qsTr("Yellow"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#FFF2A8") }
        MenuItem { text: qsTr("Red"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#F6C7C7") }
        MenuItem { text: qsTr("Green"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#C7E9D9") }
        MenuItem { text: qsTr("Blue"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#C9DDF5") }
        MenuItem { text: qsTr("Purple"); onTriggered: root.noteModel.setBackgroundColor(noteEditor.textDocument, noteEditor.selectionStart, noteEditor.selectionEnd, "#DDD1FA") }
    }

    Menu {
        id: tableContextMenu
        property int documentPosition: -1

        MenuItem {
            text: qsTr("Insert row above")
            onTriggered: root.noteModel.insertTableRow(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition, true)
        }
        MenuItem {
            text: qsTr("Insert row below")
            onTriggered: root.noteModel.insertTableRow(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition, false)
        }
        MenuItem {
            text: qsTr("Delete row")
            onTriggered: root.noteModel.deleteTableRow(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition)
        }
        MenuSeparator {}
        MenuItem {
            text: qsTr("Insert column left")
            onTriggered: root.noteModel.insertTableColumn(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition, true)
        }
        MenuItem {
            text: qsTr("Insert column right")
            onTriggered: root.noteModel.insertTableColumn(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition, false)
        }
        MenuItem {
            text: qsTr("Delete column")
            onTriggered: root.noteModel.deleteTableColumn(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition)
        }
        MenuSeparator {}
        MenuItem {
            text: qsTr("Delete table")
            onTriggered: root.noteModel.deleteTable(
                             noteEditor.textDocument,
                             tableContextMenu.documentPosition)
        }
    }
}
