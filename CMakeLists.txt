cmake_minimum_required(VERSION 3.16)

project(EquityJournal VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 REQUIRED COMPONENTS Quick QuickControls2 Sql)

qt_standard_project_setup(REQUIRES 6.10)

# Content of downloaded design from Figma to Qt or similar
if (EXISTS "${CMAKE_CURRENT_LIST_DIR}/importedcontent/CMakeLists.txt")
    add_subdirectory(${CMAKE_CURRENT_LIST_DIR}/importedcontent)
endif()

qt_add_executable(EquityJournal
    main.cpp
    src/database/databasemanager.cpp
    src/database/databasemanager.h
    src/database/migrationrunner.cpp
    src/database/migrationrunner.h
    src/models/securitymodel.cpp
    src/models/securitymodel.h
    src/models/securitynotemodel.cpp
    src/models/securitynotemodel.h
    src/models/recentsecuritiesmodel.cpp
    src/models/recentsecuritiesmodel.h
    src/models/securitytagassignmentmodel.cpp
    src/models/securitytagassignmentmodel.h
    src/models/tagtreemodel.cpp
    src/models/tagtreemodel.h
    src/models/taxonomymodel.cpp
    src/models/taxonomymodel.h
    src/models/watchlistmodel.cpp
    src/models/watchlistmodel.h
    src/repositories/securityrepository.h
    src/repositories/securitynoterepository.h
    src/repositories/sqlsecurityrepository.cpp
    src/repositories/sqlsecurityrepository.h
    src/repositories/sqlsecuritynoterepository.cpp
    src/repositories/sqlsecuritynoterepository.h
    src/repositories/securitytagrepository.h
    src/repositories/sqlsecuritytagrepository.cpp
    src/repositories/sqlsecuritytagrepository.h
    src/repositories/sqltagrepository.cpp
    src/repositories/sqltagrepository.h
    src/repositories/sqltaxonomyrepository.cpp
    src/repositories/sqltaxonomyrepository.h
    src/repositories/sqlwatchlistrepository.cpp
    src/repositories/sqlwatchlistrepository.h
    src/repositories/taxonomyrepository.h
    src/repositories/tagrepository.h
    src/repositories/watchlistrepository.h
    src/settings/applicationsettings.cpp
    src/settings/applicationsettings.h
)

set_source_files_properties(Theme.qml PROPERTIES
    QT_QML_SINGLETON_TYPE TRUE
)

qt_add_qml_module(EquityJournal
    URI EquityJournal
    QML_FILES
        Main.qml
        MainWindow.qml
        ContentRouter.qml
        DeleteSecurityWindow.qml
        DeleteTagWindow.qml
        EditorColorPalette.qml
        EditorToolButton.qml
        InsertLinkWindow.qml
        InsertTableWindow.qml
        NavigationItem.qml
        NavigationSidebar.qml
        NewSecurityWindow.qml
        NewTagWindow.qml
        NewTaxonomyWindow.qml
        NewWatchlistWindow.qml
        SecuritiesView.qml
        SecurityDetailView.qml
        SidebarSectionHeader.qml
        TagAssignmentWindow.qml
        TaxonomyView.qml
        Theme.qml
)

qt_add_resources(EquityJournal editor_icons
    PREFIX "/"
    FILES
        assets/icons/editor-bullets.svg
        assets/icons/editor-highlight.svg
        assets/icons/editor-indent-decrease.svg
        assets/icons/editor-indent-increase.svg
        assets/icons/editor-link.svg
        assets/icons/editor-numbered.svg
        assets/icons/editor-redo.svg
        assets/icons/editor-table.svg
        assets/icons/editor-undo.svg
)

qt_add_resources(EquityJournal database_migrations
    PREFIX "/migrations"
    BASE "${CMAKE_CURRENT_SOURCE_DIR}/database/migrations"
    FILES
        database/migrations/001_initial_schema.sql
        database/migrations/002_unique_security_symbol.sql
        database/migrations/003_security_tags.sql
        database/migrations/004_taxonomies.sql
        database/migrations/005_security_notes.sql
)

# Qt for iOS sets MACOSX_BUNDLE_GUI_IDENTIFIER automatically since Qt 6.1.
# If you are developing for iOS or macOS you should consider setting an
# explicit, fixed bundle identifier manually though.
set_target_properties(EquityJournal PROPERTIES
    MACOSX_BUNDLE_GUI_IDENTIFIER com.equityjournal.app
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

target_link_libraries(EquityJournal
    PRIVATE
        Qt6::Quick
        Qt6::QuickControls2
        Qt6::Sql
)

install(TARGETS EquityJournal
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
