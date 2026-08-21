use tauri::{
    menu::{CheckMenuItem, CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

#[derive(Serialize, Deserialize, Clone)]
struct DatabaseConfig {
    path: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct DocumentStorageConfig {
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

fn get_document_storage_config_path() -> PathBuf {
    if let Some(config_dir) = dirs::config_dir() {
        config_dir.join("EquityJournal/document-storage.json")
    } else {
        PathBuf::from("document-storage.json")
    }
}

fn default_document_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map(|path| path.join("attachments")).map_err(|error| error.to_string())
}

fn document_storage_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let config_path = get_document_storage_config_path();
    if config_path.exists() {
        let content = fs::read_to_string(config_path).map_err(|error| error.to_string())?;
        let config: DocumentStorageConfig = serde_json::from_str(&content).map_err(|error| error.to_string())?;
        let path = PathBuf::from(config.path);
        if path.is_absolute() { return Ok(path); }
    }
    default_document_storage_path(app)
}

fn save_document_storage_config(path: &Path) -> Result<(), String> {
    let config_path = get_document_storage_config_path();
    if let Some(parent) = config_path.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
    let config = DocumentStorageConfig { path: path.to_string_lossy().into_owned() };
    fs::write(config_path, serde_json::to_string(&config).map_err(|error| error.to_string())?).map_err(|error| error.to_string())
}

fn safe_path_part(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() || Path::new(value).components().count() != 1 || !matches!(Path::new(value).components().next(), Some(Component::Normal(_))) {
        return Err(format!("Invalid {label}."));
    }
    Ok(())
}

fn resolve_document_path(app: &tauri::AppHandle, storage_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(storage_path);
    if path.is_absolute() { return Err("Invalid managed document path.".into()); }
    let mut clean = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => clean.push(value),
            _ => return Err("Invalid managed document path.".into()),
        }
    }
    if clean.starts_with("attachments") { clean = clean.strip_prefix("attachments").map_err(|error| error.to_string())?.to_path_buf(); }
    Ok(document_storage_path(app)?.join(clean))
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() { return Ok(()); }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        let target = destination.join(entry.file_name());
        if file_type.is_dir() { copy_directory(&entry.path(), &target)?; }
        else if file_type.is_file() { fs::copy(entry.path(), target).map_err(|error| error.to_string())?; }
        else { return Err("The document folder contains an unsupported symbolic link.".into()); }
    }
    Ok(())
}

#[tauri::command]
fn get_document_storage_config(app: tauri::AppHandle) -> Result<DocumentStorageConfig, String> {
    Ok(DocumentStorageConfig { path: document_storage_path(&app)?.to_string_lossy().into_owned() })
}

#[tauri::command]
fn change_document_storage_path(app: tauri::AppHandle, new_path: String) -> Result<(), String> {
    let trimmed = new_path.trim();
    if trimmed.is_empty() { return Err("Choose a document folder.".into()); }
    let new_root = PathBuf::from(trimmed);
    if !new_root.is_absolute() { return Err("The document folder must be an absolute path.".into()); }
    let old_root = document_storage_path(&app)?;
    fs::create_dir_all(&new_root).map_err(|error| error.to_string())?;
    let canonical_new = new_root.canonicalize().map_err(|error| error.to_string())?;
    let canonical_old = old_root.canonicalize().ok();
    if canonical_old.as_ref() == Some(&canonical_new) { return save_document_storage_config(&canonical_new); }
    if let Some(old) = &canonical_old {
        if canonical_new.starts_with(old) || old.starts_with(&canonical_new) { return Err("The new document folder cannot contain, or be contained by, the current folder.".into()); }
        copy_directory(&old.join("securities"), &canonical_new.join("securities"))?;
    }
    save_document_storage_config(&canonical_new)?;
    if let Some(old) = canonical_old { let _ = fs::remove_dir_all(old.join("securities")); }
    Ok(())
}

#[tauri::command]
fn import_security_document(app: tauri::AppHandle, security_id: String, document_id: String, source_path: String) -> Result<String, String> {
    safe_path_part(&security_id, "security identifier")?;
    safe_path_part(&document_id, "document identifier")?;
    let source = PathBuf::from(source_path);
    let mut file = fs::File::open(&source).map_err(|error| error.to_string())?;
    let mut header = [0_u8; 5];
    file.read_exact(&mut header).map_err(|error| error.to_string())?;
    if &header != b"%PDF-" { return Err("The selected file is not a valid PDF document.".into()); }
    let relative = PathBuf::from("securities").join(&security_id).join(format!("{document_id}.pdf"));
    let destination = document_storage_path(&app)?.join(&relative);
    if let Some(parent) = destination.parent() { fs::create_dir_all(parent).map_err(|error| error.to_string())?; }
    fs::copy(source, destination).map_err(|error| error.to_string())?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn open_security_document(app: tauri::AppHandle, storage_path: String) -> Result<(), String> {
    let path = resolve_document_path(&app, &storage_path)?;
    if !path.is_file() { return Err("The managed PDF file could not be found.".into()); }
    app.opener().open_path(path.to_string_lossy(), None::<String>).map_err(|error| error.to_string())
}

#[tauri::command]
fn reveal_security_document(app: tauri::AppHandle, storage_path: String) -> Result<(), String> {
    let path = resolve_document_path(&app, &storage_path)?;
    if !path.is_file() { return Err("The managed PDF file could not be found.".into()); }
    app.opener().reveal_item_in_dir(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn remove_security_document(app: tauri::AppHandle, storage_path: String) -> Result<(), String> {
    let path = resolve_document_path(&app, &storage_path)?;
    if path.exists() { fs::remove_file(path).map_err(|error| error.to_string())?; }
    Ok(())
}

#[tauri::command]
fn remove_security_document_directory(app: tauri::AppHandle, security_id: String) -> Result<(), String> {
    safe_path_part(&security_id, "security identifier")?;
    let path = document_storage_path(&app)?.join("securities").join(security_id);
    if path.exists() { fs::remove_dir_all(path).map_err(|error| error.to_string())?; }
    Ok(())
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
    }, Migration {
        version: 5,
        description: "research_topics",
        sql: include_str!("../migrations/005_research_topics.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 6,
        description: "watchlist_order",
        sql: include_str!("../migrations/006_watchlist_order.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 7,
        description: "security_documents",
        sql: include_str!("../migrations/007_security_documents.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:equity-journal.sqlite3", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_theme_menu, get_database_config, save_database_config, change_database_path, get_document_storage_config, change_document_storage_path, import_security_document, open_security_document, reveal_security_document, remove_security_document, remove_security_document_directory])
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
