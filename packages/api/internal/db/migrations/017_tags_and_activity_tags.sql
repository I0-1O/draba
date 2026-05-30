-- Team-scoped tags table: enables colored pills, autocomplete, rename-all,
-- and name-based filter matching across timelines.
CREATE TABLE IF NOT EXISTS tags (
    id         TEXT PRIMARY KEY,
    team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(team_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tags_team_id ON tags(team_id);

-- The original activity_tags table (migration 001, renamed in 005) used
-- (activity_id, tag TEXT) — a simple text junction. No Go code, handler,
-- or API endpoint has ever referenced it. Safe to drop and recreate with
-- normalized FK references.
DROP TABLE IF EXISTS activity_tags;

CREATE TABLE activity_tags (
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (activity_id, tag_id)
);
