import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

StackLayout {
    id: root

    required property string currentView
    required property string currentEntityId
    required property string currentTitle
    required property string currentEntityColor
    required property var securityModel
    required property var securityTagAssignmentModel
    required property var securityNoteModel
    required property var tagTreeModel
    signal editSecurityRequested(int row)
    signal deleteSecurityRequested(string securityId, string companyName)
    signal securityActivated(string securityId)
    signal assignTagsRequested(string securityId)
    signal insertLinkRequested(var textDocument, int start, int end, string selectedText)
    signal insertTableRequested(var textDocument, int cursorPosition)
    signal newTagRequested(string taxonomyId, string parentTagId,
                           string parentName, string defaultColor)
    signal editTagRequested(string taxonomyId, string tagId, string tagName,
                            string description, string color)
    signal deleteTagRequested(string taxonomyId, string tagId, string tagName)

    currentIndex: currentView === "allSecurities" ? 0
                  : currentView === "taxonomy" ? 1
                  : currentView === "securityDetail" ? 2 : 3

    SecuritiesView {
        securityModel: root.securityModel
        onEditSecurityRequested: function(row) { root.editSecurityRequested(row) }
        onDeleteSecurityRequested: function(securityId, companyName) {
            root.deleteSecurityRequested(securityId, companyName)
        }
        onSecurityActivated: function(securityId) {
            root.securityActivated(securityId)
        }
    }

    TaxonomyView {
        taxonomyId: root.currentEntityId
        taxonomyName: root.currentTitle
        taxonomyColor: root.currentEntityColor
        tagTreeModel: root.tagTreeModel
        onNewTagRequested: function(taxonomyId, parentTagId, parentName, defaultColor) {
            root.newTagRequested(taxonomyId, parentTagId, parentName, defaultColor)
        }
        onEditTagRequested: function(taxonomyId, tagId, tagName, description, color) {
            root.editTagRequested(taxonomyId, tagId, tagName, description, color)
        }
        onDeleteTagRequested: function(taxonomyId, tagId, tagName) {
            root.deleteTagRequested(taxonomyId, tagId, tagName)
        }
    }

    SecurityDetailView {
        securityId: root.currentEntityId
        securityModel: root.securityModel
        assignmentModel: root.securityTagAssignmentModel
        noteModel: root.securityNoteModel
        onAssignTagsRequested: function(securityId) {
            root.assignTagsRequested(securityId)
        }
        onInsertLinkRequested: function(textDocument, start, end, selectedText) {
            root.insertLinkRequested(textDocument, start, end, selectedText)
        }
        onInsertTableRequested: function(textDocument, cursorPosition) {
            root.insertTableRequested(textDocument, cursorPosition)
        }
    }

    Rectangle {
        color: Theme.contentBackground

        Label {
            anchors.left: parent.left
            anchors.top: parent.top
            anchors.margins: 40
            text: root.currentTitle
            color: Theme.textPrimary
            font.pixelSize: 28
            font.weight: Font.DemiBold
        }
    }
}
