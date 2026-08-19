CREATE TABLE research_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX research_topics_title_ci ON research_topics (lower(title));
CREATE INDEX research_topics_updated_at_idx ON research_topics (updated_at DESC, lower(title));

CREATE TABLE research_topic_notes (
  topic_id TEXT PRIMARY KEY,
  content_html TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES research_topics(id) ON DELETE CASCADE
);

CREATE TABLE research_topic_journal_entries (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES research_topics(id) ON DELETE CASCADE,
  UNIQUE (topic_id, entry_date)
);

CREATE INDEX research_topic_journal_date_idx ON research_topic_journal_entries (topic_id, entry_date DESC);

CREATE TABLE research_topic_securities (
  topic_id TEXT NOT NULL,
  security_id TEXT NOT NULL,
  PRIMARY KEY (topic_id, security_id),
  FOREIGN KEY (topic_id) REFERENCES research_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (security_id) REFERENCES securities(id) ON DELETE CASCADE
);

CREATE INDEX research_topic_securities_security_idx ON research_topic_securities (security_id);

CREATE TABLE research_topic_tags (
  topic_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (topic_id, tag_id),
  FOREIGN KEY (topic_id) REFERENCES research_topics(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX research_topic_tags_tag_idx ON research_topic_tags (tag_id);
