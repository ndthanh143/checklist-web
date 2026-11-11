-- Published checklist rules. Every publish adds a row; the highest version is live.
CREATE TABLE IF NOT EXISTS content_versions (
  version INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

-- One shared working draft that is not visible to detailers until published.
CREATE TABLE IF NOT EXISTS content_draft (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);
