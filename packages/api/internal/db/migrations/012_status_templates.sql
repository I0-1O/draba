-- Phase 10.2: Status templates and timeline statuses.
--
-- Replaces team_statuses with a two-level template system:
--   status_templates      — reusable named presets owned by a team
--   status_template_items — the individual status values in a template
--   statuses              — live statuses on a specific timeline, copied from a template
--
-- activities.status_id formerly referenced team_statuses(id). Since SQLite does not
-- support ALTER TABLE … DROP CONSTRAINT, the activities table is rebuilt with the FK
-- pointing to statuses(id). All existing status_id values are NULL (no UI ever set them),
-- so the NULL-preserving INSERT below is a no-op data migration.
--
-- team_statuses is dropped after the rebuild because it is fully superseded.

-- 1. New template tables.

CREATE TABLE status_templates (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE status_template_items (
    id          TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES status_templates(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8b949e',
    icon        TEXT,
    is_closed   BOOLEAN NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0
);

-- 2. Live timeline statuses table.

CREATE TABLE statuses (
    id          TEXT PRIMARY KEY,
    timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#8b949e',
    icon        TEXT,
    is_closed   BOOLEAN NOT NULL DEFAULT 0,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 3. Rebuild activities so status_id references statuses instead of team_statuses.
--    Stash existing rows, drop, recreate, restore.

CREATE TABLE tmp_activities AS SELECT * FROM activities;
DROP TABLE activities;

CREATE TABLE activities (
    id                 TEXT PRIMARY KEY,
    team_id            TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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

-- status_id was always NULL before this phase; copy all other columns as-is.
INSERT INTO activities (
    id, team_id, title, description, icon, color, start_at, end_at, all_day,
    status_id, parent_activity_id, percent_complete, location, url, rrule,
    caldav_uid, google_event_id, created_by, created_at, updated_at, archived_at
)
SELECT
    id, team_id, title, description, icon, color, start_at, end_at, all_day,
    NULL, parent_activity_id, percent_complete, location, url, rrule,
    caldav_uid, google_event_id, created_by, created_at, updated_at, archived_at
FROM tmp_activities;

DROP TABLE tmp_activities;

-- 4. Drop team_statuses — fully superseded by status_templates + statuses.
DROP TABLE team_statuses;
