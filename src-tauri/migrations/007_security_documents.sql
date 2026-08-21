CREATE TABLE security_documents (
  id TEXT PRIMARY KEY,
  security_id TEXT NOT NULL,
  title TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT '',
  document_date TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE,
  UNIQUE (security_id, sha256)
);

CREATE INDEX security_documents_security_date_idx
  ON security_documents (security_id, document_date DESC, created_at DESC);
