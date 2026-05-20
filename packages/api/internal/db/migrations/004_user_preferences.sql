-- User preferences: per-user, optionally scoped to a timeline.
--
-- timeline_id uses '' (empty string) as a sentinel for global preferences
-- so the UNIQUE constraint on (user_id, timeline_id, key) enforces exactly
-- one value per key globally and one per key per timeline, without relying
-- on SQLite's NULL-distinct behaviour in UNIQUE constraints.

CREATE TABLE IF NOT EXISTS user_preferences (
    id          TEXT NOT NULL PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timeline_id TEXT NOT NULL DEFAULT '',
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, timeline_id, key)
);
