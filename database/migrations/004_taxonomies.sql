DROP TABLE security_tags;
DROP TABLE tags;

CREATE TABLE taxonomies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
);

CREATE UNIQUE INDEX taxonomies_name_ci
    ON taxonomies (lower(name));

CREATE INDEX taxonomies_sort_order_idx
    ON taxonomies (sort_order, lower(name));

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    taxonomy_id TEXT NOT NULL,
    parent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE RESTRICT,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX tags_unique_root_name_ci
    ON tags (taxonomy_id, lower(name))
    WHERE parent_id IS NULL;

CREATE UNIQUE INDEX tags_unique_child_name_ci
    ON tags (taxonomy_id, parent_id, lower(name))
    WHERE parent_id IS NOT NULL;

CREATE INDEX tags_parent_id_idx
    ON tags (parent_id);

CREATE INDEX tags_taxonomy_id_idx
    ON tags (taxonomy_id, sort_order, lower(name));

CREATE TABLE security_tags (
    security_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    PRIMARY KEY (security_id, tag_id),
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX security_tags_tag_id_idx
    ON security_tags (tag_id);
