use tauri::{
    menu::{CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, SubmenuBuilder},
    Emitter, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};

struct ThemeMenu {
    dark: CheckMenuItem<tauri::Wry>,
    light: CheckMenuItem<tauri::Wry>,
    system: CheckMenuItem<tauri::Wry>,
}

#[tauri::command]
fn set_theme_menu(menu: tauri::State<'_, ThemeMenu>, mode: String) {
    let _ = menu.dark.set_checked(mode == "dark");
    let _ = menu.light.set_checked(mode == "light");
    let _ = menu.system.set_checked(mode == "system");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_equity_journal_schema",
        sql: include_str!("../migrations/001_initial_schema.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:equity-journal.sqlite3", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_theme_menu])
        .setup(|app| {
            let dark = CheckMenuItemBuilder::new("Dark").id("theme-dark").checked(true).build(app)?;
            let light = CheckMenuItemBuilder::new("Light").id("theme-light").build(app)?;
            let system = CheckMenuItemBuilder::new("System").id("theme-system").build(app)?;
            let view = SubmenuBuilder::new(app, "View").item(&dark).item(&light).item(&system).build()?;
            let menu = MenuBuilder::new(app).item(&view).build()?;
            app.set_menu(menu)?;
            app.manage(ThemeMenu { dark, light, system });
            Ok(())
        })
        .on_menu_event(|app, event| {
            let mode = match event.id().as_ref() {
                "theme-dark" => Some("dark"), "theme-light" => Some("light"),
                "theme-system" => Some("system"), _ => None,
            };
            if let Some(mode) = mode {
                if let Some(menu) = app.try_state::<ThemeMenu>() {
                    let _ = menu.dark.set_checked(mode == "dark");
                    let _ = menu.light.set_checked(mode == "light");
                    let _ = menu.system.set_checked(mode == "system");
                }
                let _ = app.emit("theme-requested", mode);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running EquityJournal");
}
