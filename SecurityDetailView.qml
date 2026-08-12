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
    property int currentListStyle: 0
    property int currentHeadingLevel: 0
    property int formatSelectionStart: 0
    property int formatSelectionEnd: 0
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

    function refreshEditorToolbar() {
        currentListStyle = noteModel.listStyleAt(noteEditor.textDocument,
                                                 noteEditor.cursorPosition)
        currentHeadingLevel = noteModel.headingLevelAt(noteEditor.textDocument,
                                                       noteEditor.cursorPosition)
    }

    function rememberEditorSelection() {
        formatSelectionStart = noteEditor.selectionStart
        formatSelectionEnd = noteEditor.selectionEnd
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

    Action {
        id: boldAction
        text: qsTr("Bold")
        shortcut: StandardKey.Bold
        checkable: true
        checked: noteEditor.cursorSelection.font.bold
        onTriggered: root.noteModel.toggleBold(noteEditor.textDocument,
                                               noteEditor.selectionStart,
                                               noteEditor.selectionEnd)
    }
    Action {
        id: italicAction
        text: qsTr("Italic")
        shortcut: StandardKey.Italic
        checkable: true
        checked: noteEditor.cursorSelection.font.italic
        onTriggered: root.noteModel.toggleItalic(noteEditor.textDocument,
                                                 noteEditor.selectionStart,
                                                 noteEditor.selectionEnd)
    }
    Action {
        id: underlineAction
        text: qsTr("Underline")
        shortcut: StandardKey.Underline
        checkable: true
        checked: noteEditor.cursorSelection.font.underline
        onTriggered: root.noteModel.toggleUnderline(noteEditor.textDocument,
                                                    noteEditor.selectionStart,
                                                    noteEditor.selectionEnd)
    }
    Action {
        id: strikeAction
        text: qsTr("Strikethrough")
        checkable: true
        checked: noteEditor.cursorSelection.font.strikeout
        onTriggered: root.noteModel.toggleStrikethrough(noteEditor.textDocument,
                                                       noteEditor.selectionStart,
                                                       noteEditor.selectionEnd)
    }
    Action {
        id: bulletAction
        text: qsTr("Bulleted list")
        checkable: true
        checked: root.currentListStyle === -1
        onTriggered: {
            root.noteModel.toggleBulletList(noteEditor.textDocument,
                                            noteEditor.selectionStart,
                                            noteEditor.selectionEnd)
            Qt.callLater(root.refreshEditorToolbar)
        }
    }
    Action {
        id: numberedAction
        text: qsTr("Numbered list")
        checkable: true
        checked: root.currentListStyle === -4
        onTriggered: {
            root.noteModel.toggleNumberedList(noteEditor.textDocument,
                                              noteEditor.selectionStart,
                                              noteEditor.selectionEnd)
            Qt.callLater(root.refreshEditorToolbar)
        }
    }
    Action {
        id: undoAction
        text: qsTr("Undo")
        shortcut: StandardKey.Undo
        enabled: noteEditor.canUndo
        onTriggered: noteEditor.undo()
    }
    Action {
        id: redoAction
        text: qsTr("Redo")
        shortcut: StandardKey.Redo
        enabled: noteEditor.canRedo
        onTriggered: noteEditor.redo()
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

                Rectangle {
                    Layout.fillWidth: true
                    implicitHeight: toolbarFlow.childrenRect.height + 8
                    color: Theme.sidebarBackground
                    border.width: 1
                    border.color: Theme.border
                    radius: Theme.smallRadius

                    Flow {
                        id: toolbarFlow
                        x: 4
                        y: 4
                        width: parent.width - 8
                        spacing: 2

                        Row {
                            spacing: 1
                            EditorToolButton { action: undoAction; iconSource: "qrc:/assets/icons/editor-undo.svg" }
                            EditorToolButton { action: redoAction; iconSource: "qrc:/assets/icons/editor-redo.svg" }
                            ToolSeparator { height: 30 }
                        }

                        Row {
                            spacing: 2
                            ComboBox {
                                id: paragraphStyleBox
                                width: 132
                                height: 30
                                model: [qsTr("Paragraph"), qsTr("Heading 1"), qsTr("Heading 2")]
                                currentIndex: root.currentHeadingLevel
                                onPressedChanged: {
                                    if (pressed)
                                        root.rememberEditorSelection()
                                }
                                onActivated: {
                                    root.noteModel.setParagraphStyle(
                                        noteEditor.textDocument,
                                        root.formatSelectionStart,
                                        root.formatSelectionEnd,
                                        currentIndex)
                                    Qt.callLater(root.refreshEditorToolbar)
                                }
                            }
                            ToolSeparator { height: 30 }
                        }

                        Row {
                            spacing: 1
                            EditorToolButton { action: boldAction; displayText: "B"; font.bold: true }
                            EditorToolButton { action: italicAction; displayText: "I"; font.italic: true }
                            EditorToolButton { action: underlineAction; displayText: "U"; font.underline: true }
                            EditorToolButton { action: strikeAction; displayText: "S"; font.strikeout: true }
                            EditorToolButton {
                                id: textColorButton
                                displayText: "A"
                                tooltipText: qsTr("Text color")
                                indicatorColor: Theme.accent
                                onPressedChanged: {
                                    if (pressed)
                                        root.rememberEditorSelection()
                                }
                                onClicked: textColorPalette.popup(textColorButton, 0, height)
                            }
                            EditorToolButton {
                                id: backgroundColorButton
                                tooltipText: qsTr("Highlight color")
                                iconSource: "qrc:/assets/icons/editor-highlight.svg"
                                indicatorColor: "#F2C94C"
                                onPressedChanged: {
                                    if (pressed)
                                        root.rememberEditorSelection()
                                }
                                onClicked: backgroundColorPalette.popup(
                                               backgroundColorButton, 0, height)
                            }
                            ToolSeparator { height: 30 }
                        }

                        Row {
                            spacing: 1
                            EditorToolButton { action: bulletAction; iconSource: "qrc:/assets/icons/editor-bullets.svg" }
                            EditorToolButton { action: numberedAction; iconSource: "qrc:/assets/icons/editor-numbered.svg" }
                            EditorToolButton {
                                tooltipText: qsTr("Decrease indentation")
                                iconSource: "qrc:/assets/icons/editor-indent-decrease.svg"
                                onClicked: root.noteModel.changeIndent(noteEditor.textDocument,
                                                                       noteEditor.selectionStart,
                                                                       noteEditor.selectionEnd, -1)
                            }
                            EditorToolButton {
                                tooltipText: qsTr("Increase indentation")
                                iconSource: "qrc:/assets/icons/editor-indent-increase.svg"
                                onClicked: root.noteModel.changeIndent(noteEditor.textDocument,
                                                                       noteEditor.selectionStart,
                                                                       noteEditor.selectionEnd, 1)
                            }
                            ToolSeparator { height: 30 }
                        }

                        Row {
                            spacing: 1
                            EditorToolButton {
                                tooltipText: qsTr("Insert link")
                                iconSource: "qrc:/assets/icons/editor-link.svg"
                                onClicked: root.insertLinkRequested(
                                               noteEditor.textDocument,
                                               noteEditor.selectionStart,
                                               noteEditor.selectionEnd,
                                               noteEditor.selectedText)
                            }
                            EditorToolButton {
                                tooltipText: qsTr("Insert table")
                                iconSource: "qrc:/assets/icons/editor-table.svg"
                                onClicked: root.insertTableRequested(
                                               noteEditor.textDocument,
                                               noteEditor.cursorPosition)
                            }
                        }
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
                            persistentSelection: true
                            Keys.priority: Keys.BeforeItem
                            Keys.onTabPressed: function(event) {
                                if (root.noteModel.listStyleAt(textDocument,
                                                               cursorPosition) === 0) {
                                    event.accepted = false
                                    return
                                }
                                root.noteModel.changeIndent(textDocument,
                                                            selectionStart,
                                                            selectionEnd, 1)
                                event.accepted = true
                            }
                            Keys.onBacktabPressed: function(event) {
                                if (root.noteModel.listStyleAt(textDocument,
                                                               cursorPosition) === 0) {
                                    event.accepted = false
                                    return
                                }
                                root.noteModel.changeIndent(textDocument,
                                                            selectionStart,
                                                            selectionEnd, -1)
                                event.accepted = true
                            }
                            placeholderText: qsTr("Write your investment thesis, observations, and open questions…")
                            color: Theme.textPrimary
                            onTextChanged: {
                                if (!root.loadingNote && root.editorSecurityId.length > 0)
                                    saveTimer.restart()
                            }
                            onCursorPositionChanged: root.refreshEditorToolbar()
                            onSelectionStartChanged: root.refreshEditorToolbar()

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

    EditorColorPalette {
        id: textColorPalette
        title: qsTr("Text color")
        clearText: qsTr("Automatic")
        colors: ["#172033", "#F2F4F7", "#C25555", "#C47F17", "#2E8B78", "#3478C9", "#7A5AF8", "#9B5C8F", "#667085", "#000000", "#FFFFFF", "#B42318"]
        onColorSelected: function(color) {
            root.noteModel.setTextColor(noteEditor.textDocument,
                                        root.formatSelectionStart,
                                        root.formatSelectionEnd, color)
        }
    }

    EditorColorPalette {
        id: backgroundColorPalette
        title: qsTr("Highlight color")
        clearText: qsTr("No highlight")
        colors: ["#FFF2A8", "#F6C7C7", "#FAD8B4", "#C7E9D9", "#C9DDF5", "#DDD1FA", "#E4E7EC", "#FDE68A", "#FECACA", "#BBF7D0", "#BFDBFE", "#E9D5FF"]
        onColorSelected: function(color) {
            root.noteModel.setBackgroundColor(noteEditor.textDocument,
                                              root.formatSelectionStart,
                                              root.formatSelectionEnd, color)
        }
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
