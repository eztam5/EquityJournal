ALTER TABLE securities ADD COLUMN alternative_id TEXT NOT NULL DEFAULT '';

CREATE TABLE security_link_templates (
  id TEXT PRIMARY KEY,
  link_text TEXT NOT NULL,
  url_pattern TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX security_link_templates_sort_order_idx
  ON security_link_templates (sort_order, id);
