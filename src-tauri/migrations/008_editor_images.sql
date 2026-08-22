CREATE TABLE editor_images (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('security','topic')),
  owner_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','image/gif')),
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  orphaned_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX editor_images_owner_idx ON editor_images (owner_type, owner_id);
CREATE INDEX editor_images_orphaned_idx ON editor_images (orphaned_at) WHERE orphaned_at IS NOT NULL;

CREATE TABLE editor_image_references (
  image_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('security-note','security-journal','topic-note','topic-journal')),
  content_id TEXT NOT NULL,
  PRIMARY KEY (image_id, content_type, content_id),
  FOREIGN KEY (image_id) REFERENCES editor_images(id) ON DELETE CASCADE
);

CREATE INDEX editor_image_references_content_idx ON editor_image_references (content_type, content_id);
