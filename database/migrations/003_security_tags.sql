CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    archived_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX tags_unique_root_name_ci
    ON tags (namespace, lower(name))
    WHERE parent_id IS NULL;

CREATE UNIQUE INDEX tags_unique_child_name_ci
    ON tags (namespace, parent_id, lower(name))
    WHERE parent_id IS NOT NULL;

CREATE INDEX tags_parent_id_idx
    ON tags (parent_id);

CREATE INDEX tags_namespace_idx
    ON tags (namespace);

CREATE TABLE security_tags (
    security_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (security_id, tag_id),
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX security_tags_tag_id_idx
    ON security_tags (tag_id);
