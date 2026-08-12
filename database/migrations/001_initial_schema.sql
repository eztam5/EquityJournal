CREATE TABLE securities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    currency TEXT NOT NULL
);

CREATE TABLE watchlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE UNIQUE INDEX watchlists_name_ci
    ON watchlists (lower(name));

CREATE TABLE watchlist_securities (
    watchlist_id TEXT NOT NULL,
    security_id TEXT NOT NULL,
    PRIMARY KEY (watchlist_id, security_id),
    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX watchlist_securities_security_id_idx
    ON watchlist_securities (security_id);
