CREATE TABLE security_notes (
    security_id TEXT PRIMARY KEY,
    content_html TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);
