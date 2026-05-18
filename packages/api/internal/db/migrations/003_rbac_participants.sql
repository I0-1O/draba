-- RBAC & Participants refactor.
--
-- Changes:
--   users           → add is_superadmin (first registered user gets true)
--   team_members    → add id PK, nullable user_id, display_name
--   event_assignments → swap user_id FK for team_member_id FK
--   timeline_access → swap user_id FK for team_member_id FK, add role column
--   timelines       → drop visibility column
--
-- SQLite requires a full table-rebuild to drop columns or change PKs.
-- Rather than toggling PRAGMA foreign_keys (a no-op inside implicit
-- transactions), we drop child tables first (safe with FK=ON), stash their
-- data in temp tables, then rebuild parents, and finally recreate the
-- children with the new schema.

-- 1. users: add superadmin flag; DEFAULT 0 leaves existing rows as non-superadmin.
ALTER TABLE users ADD COLUMN is_superadmin BOOLEAN NOT NULL DEFAULT 0;

-- 2. Stash child-table data before dropping them.
--    Explicit CREATE + INSERT avoids driver-level compatibility issues with
--    CREATE TABLE … AS SELECT.
CREATE TABLE tmp_event_assignments (
    event_id TEXT NOT NULL,
    user_id  TEXT NOT NULL
);
INSERT INTO tmp_event_assignments (event_id, user_id)
    SELECT event_id, user_id FROM event_assignments;

CREATE TABLE tmp_timeline_access (
    timeline_id TEXT NOT NULL,
    user_id     TEXT NOT NULL
);
INSERT INTO tmp_timeline_access (timeline_id, user_id)
    SELECT timeline_id, user_id FROM timeline_access;

-- 3. Drop child tables (the tables that own the outgoing FKs).
--    Dropping a table that holds FKs is always safe regardless of FK enforcement.
DROP TABLE event_assignments;
DROP TABLE timeline_access;

-- 4. team_members: add id PK, make user_id nullable, add display_name.
--    Nothing in the remaining schema references team_members, so this is safe.
CREATE TABLE team_members_new (
    id           TEXT NOT NULL,
    team_id      TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id      TEXT REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    role         TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    color        TEXT,
    joined_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (id)
);

INSERT INTO team_members_new (id, team_id, user_id, display_name, role, color, joined_at)
    SELECT lower(hex(randomblob(16))), team_id, user_id, NULL, role, color, joined_at
    FROM team_members;

DROP TABLE team_members;
ALTER TABLE team_members_new RENAME TO team_members;

-- 5. timelines: drop the visibility column.
--    timeline_access was dropped above, so timelines is no longer referenced.
CREATE TABLE timelines_new (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    share_token TEXT NOT NULL UNIQUE,
    ical_token  TEXT NOT NULL UNIQUE,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    archived_at DATETIME
);

INSERT INTO timelines_new (id, team_id, name, start_date, end_date, share_token, ical_token, created_by, created_at, updated_at, archived_at)
    SELECT id, team_id, name, start_date, end_date, share_token, ical_token, created_by, created_at, updated_at, archived_at
    FROM timelines;

DROP TABLE timelines;
ALTER TABLE timelines_new RENAME TO timelines;

-- 6. Recreate event_assignments with team_member_id FK.
--    Join through events to find the team, then match team_members by user_id.
CREATE TABLE event_assignments (
    event_id       TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, team_member_id)
);

INSERT INTO event_assignments (event_id, team_member_id)
    SELECT ea.event_id, tm.id
    FROM tmp_event_assignments ea
    JOIN events e ON e.id = ea.event_id
    JOIN team_members tm ON tm.team_id = e.team_id AND tm.user_id = ea.user_id;

DROP TABLE tmp_event_assignments;

-- 7. Recreate timeline_access with team_member_id FK and role column.
--    Migrated rows default to role='member'.
CREATE TABLE timeline_access (
    timeline_id    TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    PRIMARY KEY (timeline_id, team_member_id)
);

INSERT INTO timeline_access (timeline_id, team_member_id, role)
    SELECT ta.timeline_id, tm.id, 'member'
    FROM tmp_timeline_access ta
    JOIN timelines t ON t.id = ta.timeline_id
    JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = ta.user_id;

DROP TABLE tmp_timeline_access;
