CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    applied_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    avatar_url    TEXT,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id   TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    color     TEXT,
    joined_at DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_statuses (
    id         TEXT PRIMARY KEY,
    team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT NOT NULL,
    position   INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invites (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    invited_by  TEXT NOT NULL REFERENCES users(id),
    expires_at  DATETIME NOT NULL,
    accepted_at DATETIME,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    scope       TEXT NOT NULL CHECK (scope IN ('read', 'add', 'edit_own', 'edit_all')),
    last_used_at DATETIME,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    revoked_at  DATETIME
);

CREATE TABLE IF NOT EXISTS events (
    id               TEXT PRIMARY KEY,
    team_id          TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    description      TEXT,
    icon             TEXT,
    color            TEXT,
    start_at         DATETIME NOT NULL,
    end_at           DATETIME NOT NULL,
    all_day          BOOLEAN NOT NULL DEFAULT 0,
    status_id        TEXT REFERENCES team_statuses(id),
    parent_event_id  TEXT REFERENCES events(id),
    percent_complete INTEGER,
    location         TEXT,
    url              TEXT,
    rrule            TEXT,
    caldav_uid       TEXT,
    google_event_id  TEXT,
    created_by       TEXT NOT NULL REFERENCES users(id),
    created_at       DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at       DATETIME NOT NULL DEFAULT (datetime('now')),
    archived_at      DATETIME
);

CREATE TABLE IF NOT EXISTS event_tags (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    tag      TEXT NOT NULL,
    PRIMARY KEY (event_id, tag)
);

CREATE TABLE IF NOT EXISTS event_assignments (
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS timelines (
    id          TEXT PRIMARY KEY,
    team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    start_date  TEXT NOT NULL,
    end_date    TEXT NOT NULL,
    visibility  TEXT NOT NULL CHECK (visibility IN ('public', 'restricted')),
    share_token TEXT NOT NULL UNIQUE,
    ical_token  TEXT NOT NULL UNIQUE,
    created_by  TEXT NOT NULL REFERENCES users(id),
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    archived_at DATETIME
);

CREATE TABLE IF NOT EXISTS timeline_access (
    timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (timeline_id, user_id)
);

CREATE TABLE IF NOT EXISTS calendar_connections (
    id                    TEXT PRIMARY KEY,
    user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider              TEXT NOT NULL CHECK (provider IN ('google', 'caldav')),
    credentials_encrypted TEXT,
    caldav_url            TEXT,
    last_synced_at        DATETIME,
    created_at            DATETIME NOT NULL DEFAULT (datetime('now'))
);
