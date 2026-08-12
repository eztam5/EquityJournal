import QtQuick
import QtQuick.Layouts
import QtQuick.Controls

StackLayout {
    id: root

    required property string currentView
    required property string currentTitle
    required property var securityModel
    signal editSecurityRequested(int row)
    signal deleteSecurityRequested(string securityId, string companyName)

    currentIndex: currentView === "allSecurities" ? 0 : 1

    SecuritiesView {
        securityModel: root.securityModel
        onEditSecurityRequested: function(row) { root.editSecurityRequested(row) }
        onDeleteSecurityRequested: function(securityId, companyName) {
            root.deleteSecurityRequested(securityId, companyName)
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
