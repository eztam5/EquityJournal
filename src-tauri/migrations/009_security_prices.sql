CREATE TABLE IF NOT EXISTS security_prices (
    security_id TEXT NOT NULL,
    price_date TEXT NOT NULL,
    close REAL NOT NULL,
    adjusted_close REAL NOT NULL,
    currency TEXT NOT NULL,
    source_symbol TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    PRIMARY KEY (security_id, price_date),
    FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS security_prices_security_date_idx
ON security_prices (security_id, price_date);
