-- Migration 023: make shares.created_by nullable.
--
-- A superadmin may manage a team they hold no team_members row in;
-- requireTeamMember passes them through with a synthetic member whose ID is
-- "". Share creation wrote that empty string into the NOT NULL created_by FK
-- and blew up with a constraint failure (500). A NULL created_by now means
-- "created by a superadmin outside the team" — the UI already falls back to
-- a generic creator label when the member lookup misses.
--
-- SQLite cannot drop NOT NULL in place, so this is a standard table rebuild.

CREATE TABLE shares_new (
  id             TEXT PRIMARY KEY,
  timeline_id    TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  view_type      TEXT NOT NULL DEFAULT 'gantt',
  view_config    TEXT NOT NULL DEFAULT '{}',
  password_hash  TEXT,
  expires_at     DATETIME,
  created_by     TEXT REFERENCES team_members(id),
  created_at     DATETIME NOT NULL,
  last_viewed_at DATETIME,
  view_count     INTEGER NOT NULL DEFAULT 0,
  revoked_at     DATETIME,
  name           TEXT,
  description    TEXT,
  kind           TEXT NOT NULL DEFAULT 'view',
  scope          TEXT,
  member_id      TEXT REFERENCES team_members(id) ON DELETE CASCADE
);

INSERT INTO shares_new (
  id, timeline_id, token, view_type, view_config, password_hash, expires_at,
  created_by, created_at, last_viewed_at, view_count, revoked_at, name,
  description, kind, scope, member_id
)
SELECT
  id, timeline_id, token, view_type, view_config, password_hash, expires_at,
  created_by, created_at, last_viewed_at, view_count, revoked_at, name,
  description, kind, scope, member_id
FROM shares;

DROP TABLE shares;
ALTER TABLE shares_new RENAME TO shares;

CREATE INDEX idx_shares_timeline_id ON shares(timeline_id);
CREATE INDEX idx_shares_token       ON shares(token);
