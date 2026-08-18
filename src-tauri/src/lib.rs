use tauri::{
    menu::{CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone)]
struct DatabaseConfig {
    path: String,
}

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

#[tauri::command]
fn get_database_config() -> DatabaseConfig {
    let config_path = get_config_file_path();
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<DatabaseConfig>(&content) {
                return config;
            }
        }
    }
    
    DatabaseConfig {
        path: get_default_db_path(),
    }
}

#[tauri::command]
fn save_database_config(config: DatabaseConfig) -> Result<(), String> {
    let config_path = get_config_file_path();
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn change_database_path(new_path: String, copy_existing: bool) -> Result<(), String> {
    let old_path = get_default_db_path();
    let old_path_buf = PathBuf::from(&old_path);
    let new_path_buf = PathBuf::from(&new_path);
    
    if copy_existing && old_path_buf.exists() {
        if let Some(parent) = new_path_buf.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(&old_path_buf, &new_path_buf).map_err(|e| e.to_string())?;
    }
    
    // Save the new path to config
    save_database_config(DatabaseConfig { path: new_path })?;
    
    Ok(())
}

fn get_default_db_path() -> String {
    if let Some(data_dir) = dirs::data_dir() {
        format!("{}/EquityJournal/equity-journal.db", data_dir.display())
    } else {
        "equity-journal.db".to_string()
    }
}

fn get_config_file_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        config_dir.join("EquityJournal/config.json")
    } else {
        PathBuf::from("config.json")
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_equity_journal_schema",
        sql: include_str!("../migrations/001_initial_schema.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 2,
        description: "cascade_nested_tag_deletion",
        sql: include_str!("../migrations/002_tags_parent_cascade.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 3,
        description: "security_journal_entries",
        sql: include_str!("../migrations/003_security_journal_entries.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 4,
        description: "security_alternative_id_and_link_templates",
        sql: include_str!("../migrations/004_security_links.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:equity-journal.sqlite3", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_theme_menu, get_database_config, save_database_config, change_database_path])
        .setup(|app| {
            let dark = CheckMenuItemBuilder::new("Dark").id("theme-dark").checked(true).build(app)?;
            let light = CheckMenuItemBuilder::new("Light").id("theme-light").build(app)?;
            let system = CheckMenuItemBuilder::new("System").id("theme-system").build(app)?;
            let view = SubmenuBuilder::new(app, "View")
                .item(&dark)
                .item(&light)
                .item(&system)
                .build()?;
            let settings = MenuItemBuilder::new("Settings").id("open-settings").build(app)?;
            let app_menu = SubmenuBuilder::new(app, "EquityJournal")
                .item(&settings)
                .build()?;
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let menu = MenuBuilder::new(app)
                .item(&app_menu)
                .item(&edit)
                .item(&view)
                .build()?;
            app.set_menu(menu)?;
            app.manage(ThemeMenu { dark, light, system });
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "theme-dark" | "theme-light" | "theme-system" => {
                    let mode = event.id().as_ref().strip_prefix("theme-").unwrap_or("");
                    if let Some(menu) = app.try_state::<ThemeMenu>() {
                        let _ = menu.dark.set_checked(mode == "dark");
                        let _ = menu.light.set_checked(mode == "light");
                        let _ = menu.system.set_checked(mode == "system");
                    }
                    let _ = app.emit("theme-requested", mode);
                }
                "open-settings" => {
                    let _ = app.emit("open-settings", ());
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running EquityJournal");
}
