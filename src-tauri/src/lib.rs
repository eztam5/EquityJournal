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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct YahooPricePoint {
    timestamp: i64,
    close: f64,
    adjusted_close: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct YahooPriceHistory {
    symbol: String,
    currency: String,
    exchange_name: String,
    time_zone: String,
    company_name: String,
    prices: Vec<YahooPricePoint>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct YahooSecuritySearchResult {
    symbol: String,
    name: String,
    exchange: String,
    exchange_name: String,
    quote_type: String,
}

#[derive(Deserialize)]
struct YahooSearchResponse { quotes: Option<Vec<YahooSearchQuote>> }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooSearchQuote { symbol: Option<String>, shortname: Option<String>, longname: Option<String>, exchange: Option<String>, exch_disp: Option<String>, quote_type: Option<String>, is_yahoo_finance: Option<bool> }

#[derive(Deserialize)]
struct YahooChartResponse { chart: YahooChart }
#[derive(Deserialize)]
struct YahooChart { result: Option<Vec<YahooChartResult>>, error: Option<YahooChartError> }
#[derive(Deserialize)]
struct YahooChartError { description: Option<String> }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooChartResult { meta: YahooChartMeta, timestamp: Option<Vec<i64>>, indicators: YahooIndicators }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooChartMeta { symbol: String, currency: Option<String>, exchange_name: Option<String>, exchange_timezone_name: Option<String>, long_name: Option<String>, short_name: Option<String> }
#[derive(Deserialize)]
struct YahooIndicators { quote: Option<Vec<YahooQuote>>, adjclose: Option<Vec<YahooAdjustedClose>> }
#[derive(Deserialize)]
struct YahooQuote { close: Option<Vec<Option<f64>>> }
#[derive(Deserialize)]
struct YahooAdjustedClose { adjclose: Option<Vec<Option<f64>>> }

fn yahoo_chart_url(host: &str, symbol: &str, range: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(&format!("https://{host}/v8/finance/chart/")).map_err(|error| error.to_string())?;
    url.path_segments_mut().map_err(|_| "Could not build the Yahoo Finance URL.".to_string())?.pop_if_empty().push(symbol);
    url.query_pairs_mut().append_pair("range", range).append_pair("interval", "1d").append_pair("events", "div,splits");
    Ok(url)
}

fn yahoo_search_url(host: &str, query: &str) -> Result<reqwest::Url, String> {
    let mut url = reqwest::Url::parse(&format!("https://{host}/v1/finance/search")).map_err(|error| error.to_string())?;
    url.query_pairs_mut().append_pair("q", query).append_pair("quotesCount", "8").append_pair("newsCount", "0");
    Ok(url)
}

#[tauri::command]
async fn search_yahoo_securities(query: String) -> Result<Vec<YahooSecuritySearchResult>, String> {
    let query = query.trim();
    if query.len() < 2 { return Ok(Vec::new()); }
    if query.len() > 100 { return Err("Enter a shorter security search.".to_string()); }
    let client = reqwest::Client::builder().user_agent("Mozilla/5.0 (compatible; EquityJournal/0.1)").timeout(std::time::Duration::from_secs(15)).build().map_err(|error| error.to_string())?;
    let mut response = None;
    let mut last_error = None;
    for host in ["query2.finance.yahoo.com", "query1.finance.yahoo.com"] {
        match client.get(yahoo_search_url(host, query)?).send().await {
            Ok(candidate) if candidate.status().is_success() => { response = Some(candidate); break; }
            Ok(candidate) => { last_error = Some(format!("Yahoo Finance returned an error ({}).", candidate.status())); }
            Err(error) => { last_error = Some(format!("Could not reach Yahoo Finance: {error}")); }
        }
    }
    let body: YahooSearchResponse = response.ok_or_else(|| last_error.unwrap_or_else(|| "Yahoo Finance search is unavailable.".to_string()))?.json().await.map_err(|error| format!("Yahoo Finance returned an unexpected search response: {error}"))?;
    let mut seen = std::collections::HashSet::new();
    Ok(body.quotes.unwrap_or_default().into_iter().filter_map(|quote| {
        if quote.is_yahoo_finance == Some(false) { return None; }
        let symbol = quote.symbol?.trim().to_uppercase();
        if symbol.is_empty() || !seen.insert(symbol.clone()) { return None; }
        let name = quote.longname.or(quote.shortname).unwrap_or_else(|| symbol.clone());
        Some(YahooSecuritySearchResult { symbol, name, exchange: quote.exchange.unwrap_or_default(), exchange_name: quote.exch_disp.unwrap_or_default(), quote_type: quote.quote_type.unwrap_or_default() })
    }).collect())
}

#[tauri::command]
async fn fetch_yahoo_prices(symbol: String, range: Option<String>) -> Result<YahooPriceHistory, String> {
    let symbol = symbol.trim().to_uppercase();
    if symbol.is_empty() || symbol.len() > 32 { return Err("Enter a valid Yahoo Finance symbol.".to_string()); }
    let range = range.unwrap_or_else(|| "max".to_string());
    if !matches!(range.as_str(), "1d" | "1mo" | "10y") { return Err("Unsupported price-history range.".to_string()); }

    let client = reqwest::Client::builder().user_agent("Mozilla/5.0 (compatible; EquityJournal/0.1)").timeout(std::time::Duration::from_secs(20)).build().map_err(|error| error.to_string())?;
    let mut response = None;
    let mut last_status = None;
    let mut last_error = None;
    for host in ["query1.finance.yahoo.com", "query2.finance.yahoo.com"] {
        let url = yahoo_chart_url(host, &symbol, &range)?;
        match client.get(url).send().await {
            Ok(candidate) if candidate.status().is_success() => { response = Some(candidate); break; }
            Ok(candidate) => { last_status = Some(candidate.status()); }
            Err(error) => { last_error = Some(error.to_string()); }
        }
    }
    let response = response.ok_or_else(|| match last_status {
        Some(reqwest::StatusCode::NOT_FOUND) => format!("Yahoo Finance could not find the symbol {symbol}."),
        Some(reqwest::StatusCode::TOO_MANY_REQUESTS) => "Yahoo Finance is temporarily rate-limiting price requests. Please try again shortly.".to_string(),
        Some(status) => format!("Yahoo Finance returned an error ({status})."),
        None => format!("Could not reach Yahoo Finance: {}", last_error.unwrap_or_else(|| "unknown network error".to_string())),
    })?;
    let body: YahooChartResponse = response.json().await.map_err(|error| format!("Yahoo Finance returned an unexpected response: {error}"))?;
    if let Some(error) = body.chart.error { return Err(error.description.unwrap_or_else(|| "Yahoo Finance could not load this symbol.".to_string())); }
    let result = body.chart.result.and_then(|mut results| results.drain(..).next()).ok_or_else(|| format!("Yahoo Finance returned no prices for {symbol}."))?;
    let timestamps = result.timestamp.unwrap_or_default();
    let closes = result.indicators.quote.and_then(|mut quotes| quotes.drain(..).next()).and_then(|quote| quote.close).unwrap_or_default();
    let adjusted = result.indicators.adjclose.and_then(|mut values| values.drain(..).next()).and_then(|value| value.adjclose).unwrap_or_default();
    let prices = timestamps.into_iter().enumerate().filter_map(|(index, timestamp)| {
        let close = closes.get(index).copied().flatten()?;
        let adjusted_close = adjusted.get(index).copied().flatten().unwrap_or(close);
        if close.is_finite() && adjusted_close.is_finite() && close > 0.0 && adjusted_close > 0.0 { Some(YahooPricePoint { timestamp, close, adjusted_close }) } else { None }
    }).collect::<Vec<_>>();
    if prices.is_empty() { return Err(format!("Yahoo Finance returned no daily prices for {symbol}.")); }
    Ok(YahooPriceHistory {
        symbol: result.meta.symbol,
        currency: result.meta.currency.unwrap_or_default(),
        exchange_name: result.meta.exchange_name.unwrap_or_default(),
        time_zone: result.meta.exchange_timezone_name.unwrap_or_else(|| "UTC".to_string()),
        company_name: result.meta.long_name.or(result.meta.short_name).unwrap_or_default(),
        prices,
    })
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
        copy_directory(&old.join("topics"), &canonical_new.join("topics"))?;
        copy_directory(&old.join("favicons"), &canonical_new.join("favicons"))?;
    }
    save_document_storage_config(&canonical_new)?;
    if let Some(old) = canonical_old { let _ = fs::remove_dir_all(old.join("securities"));let _ = fs::remove_dir_all(old.join("topics"));let _ = fs::remove_dir_all(old.join("favicons")); }
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

// Fetch through the desktop backend so site CORS policies do not block icons.
#[tauri::command]
async fn fetch_favicon_resource(url: String) -> Result<Vec<u8>, String> {
    let url = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "http" | "https") { return Err("Invalid favicon URL".into()); }
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build().map_err(|error| error.to_string())?;
    let mut response = client.get(url).send().await.map_err(|error| error.to_string())?
        .error_for_status().map_err(|error| error.to_string())?;
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| error.to_string())? {
        if bytes.len() + chunk.len() > 1024 * 1024 { return Err("Favicon resource too large".into()); }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn favicon_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    editor_image_format(bytes).or_else(|| {
        if bytes.len() >= 6 && bytes.starts_with(&[0, 0, 1, 0]) { Some(("image/x-icon", "ico")) } else { None }
    })
}

#[tauri::command]
fn store_favicon(app: tauri::AppHandle, id: String, bytes: Vec<u8>) -> Result<String, String> {
    safe_path_part(&id, "favicon identifier")?;
    if bytes.len() > 1024 * 1024 { return Err("Favicon too large".into()); }
    let (_, extension) = favicon_format(&bytes).ok_or("Unsupported favicon format")?;
    let relative = format!("favicons/{id}.{extension}");
    let path = document_storage_path(&app)?.join(&relative);
    fs::create_dir_all(path.parent().ok_or("Invalid favicon path")?).map_err(|error| error.to_string())?;
    fs::write(path, bytes).map_err(|error| error.to_string())?;
    Ok(relative)
}

#[tauri::command]
fn load_favicon(app: tauri::AppHandle, storage_path: String) -> Result<Vec<u8>, String> {
    if !storage_path.starts_with("favicons/") { return Err("Invalid favicon path".into()); }
    let bytes = fs::read(resolve_document_path(&app, &storage_path)?).map_err(|error| error.to_string())?;
    favicon_format(&bytes).ok_or("Invalid favicon")?;
    Ok(bytes)
}

fn editor_image_format(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0x89,b'P',b'N',b'G',0x0d,0x0a,0x1a,0x0a]) { Some(("image/png","png")) }
    else if bytes.starts_with(&[0xff,0xd8,0xff]) { Some(("image/jpeg","jpg")) }
    else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { Some(("image/gif","gif")) }
    else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" { Some(("image/webp","webp")) }
    else { None }
}

#[tauri::command]
fn store_editor_image(app: tauri::AppHandle, owner_type: String, owner_id: String, image_id: String, bytes: Vec<u8>) -> Result<String, String> {
    safe_path_part(&owner_id,"image owner identifier")?;safe_path_part(&image_id,"image identifier")?;
    if bytes.len() > 10 * 1024 * 1024 { return Err("Images must be 10 MB or smaller.".into()); }
    let (_,extension)=editor_image_format(&bytes).ok_or_else(|| "Choose a PNG, JPEG, WebP, or GIF image.".to_string())?;
    let owner_directory=match owner_type.as_str(){"security"=>"securities","topic"=>"topics",_=>return Err("Invalid image owner type.".into())};
    let relative=PathBuf::from(owner_directory).join(&owner_id).join("images").join(format!("{image_id}.{extension}"));
    let destination=document_storage_path(&app)?.join(&relative);
    if let Some(parent)=destination.parent(){fs::create_dir_all(parent).map_err(|error|error.to_string())?;}
    fs::write(destination,bytes).map_err(|error|error.to_string())?;
    Ok(relative.to_string_lossy().replace('\\',"/"))
}

#[tauri::command]
fn load_editor_image(app: tauri::AppHandle, storage_path: String) -> Result<Vec<u8>, String> {
    let path=resolve_document_path(&app,&storage_path)?;
    let bytes=fs::read(path).map_err(|_|"The managed image file could not be found.".to_string())?;
    editor_image_format(&bytes).ok_or_else(||"The managed image file is invalid.".to_string())?;
    Ok(bytes)
}

#[tauri::command]
fn remove_editor_image(app: tauri::AppHandle, storage_path: String) -> Result<(), String> {
    let path=resolve_document_path(&app,&storage_path)?;
    if path.exists(){fs::remove_file(path).map_err(|error|error.to_string())?;}Ok(())
}

#[tauri::command]
fn remove_topic_attachment_directory(app: tauri::AppHandle, topic_id: String) -> Result<(), String> {
    safe_path_part(&topic_id,"research topic identifier")?;
    let path=document_storage_path(&app)?.join("topics").join(topic_id);
    if path.exists(){fs::remove_dir_all(path).map_err(|error|error.to_string())?;}Ok(())
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
    }, Migration {
        version: 8,
        description: "editor_images",
        sql: include_str!("../migrations/008_editor_images.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 9,
        description: "security_prices",
        sql: include_str!("../migrations/009_security_prices.sql"),
        kind: MigrationKind::Up,
    }, Migration {
        version: 10,
        description: "security_link_favicons",
        sql: include_str!("../migrations/010_security_link_favicons.sql"),
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
        .invoke_handler(tauri::generate_handler![fetch_favicon_resource, store_favicon, load_favicon, set_theme_menu, get_database_config, save_database_config, change_database_path, fetch_yahoo_prices, search_yahoo_securities, get_document_storage_config, change_document_storage_path, import_security_document, open_security_document, reveal_security_document, remove_security_document, remove_security_document_directory, store_editor_image, load_editor_image, remove_editor_image, remove_topic_attachment_directory])
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

#[cfg(test)]
mod yahoo_url_tests {
    use super::{yahoo_chart_url, yahoo_search_url};

    #[test]
    fn builds_a_single_slash_before_the_encoded_symbol() {
        let url = yahoo_chart_url("query1.finance.yahoo.com", "AMR", "10y").expect("valid Yahoo URL");
        assert_eq!(url.path(), "/v8/finance/chart/AMR");
        assert_eq!(url.query(), Some("range=10y&interval=1d&events=div%2Csplits"));
    }

    #[test]
    fn builds_an_encoded_security_search_url() {
        let url = yahoo_search_url("query2.finance.yahoo.com", "Berkshire Hathaway").expect("valid Yahoo search URL");
        assert_eq!(url.path(), "/v1/finance/search");
        assert_eq!(url.query(), Some("q=Berkshire+Hathaway&quotesCount=8&newsCount=0"));
    }
}
