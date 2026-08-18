CREATE TABLE security_journal_entries (
  id TEXT PRIMARY KEY,
  security_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE,
  UNIQUE (security_id, entry_date)
);

CREATE INDEX security_journal_entries_security_date_idx
  ON security_journal_entries (security_id, entry_date DESC);
