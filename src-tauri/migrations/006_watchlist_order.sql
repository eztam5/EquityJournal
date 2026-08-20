ALTER TABLE watchlists ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE watchlists
SET sort_order = (
  SELECT COUNT(*)
  FROM watchlists AS preceding
  WHERE lower(preceding.name) < lower(watchlists.name)
     OR (lower(preceding.name) = lower(watchlists.name) AND preceding.id < watchlists.id)
);

CREATE INDEX watchlists_sort_order_idx
  ON watchlists (sort_order, lower(name), id);
