-- Backfill any activities that lack a timeline_id by assigning them to the
-- team's oldest timeline. In practice this column has been populated since
-- Phase 10.4.1, so the UPDATE should affect zero rows on current data.
UPDATE activities
SET timeline_id = (
    SELECT id FROM timelines
    WHERE team_id = activities.team_id
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE timeline_id IS NULL;

-- Rebuild the activities table to:
--   1. Drop the redundant team_id column (activity → timeline → team is sufficient)
--   2. Harden timeline_id to NOT NULL with ON DELETE CASCADE
-- SQLite does not support DROP COLUMN with FK changes, so we use
-- the CREATE-new / INSERT / DROP-old / RENAME pattern.
CREATE TABLE activities_new (
    id                 TEXT PRIMARY KEY,
    timeline_id        TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    title              TEXT NOT NULL,
    description        TEXT,
    icon               TEXT,
    color              TEXT,
    start_at           DATETIME NOT NULL,
    end_at             DATETIME NOT NULL,
    all_day            BOOLEAN NOT NULL DEFAULT 0,
    status_id          TEXT REFERENCES statuses(id) ON DELETE SET NULL,
    parent_activity_id TEXT REFERENCES activities(id),
    percent_complete   INTEGER,
    location           TEXT,
    url                TEXT,
    rrule              TEXT,
    caldav_uid         TEXT,
    google_event_id    TEXT,
    created_by         TEXT NOT NULL REFERENCES users(id),
    created_at         DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at         DATETIME NOT NULL DEFAULT (datetime('now')),
    archived_at        DATETIME
);

INSERT INTO activities_new (
    id, timeline_id, title, description, icon, color,
    start_at, end_at, all_day, status_id, parent_activity_id,
    percent_complete, location, url, rrule, caldav_uid, google_event_id,
    created_by, created_at, updated_at, archived_at
)
SELECT
    id, timeline_id, title, description, icon, color,
    start_at, end_at, all_day, status_id, parent_activity_id,
    percent_complete, location, url, rrule, caldav_uid, google_event_id,
    created_by, created_at, updated_at, archived_at
FROM activities
WHERE timeline_id IS NOT NULL;

DROP TABLE activities;
ALTER TABLE activities_new RENAME TO activities;

CREATE INDEX IF NOT EXISTS idx_activities_timeline_id ON activities(timeline_id);
