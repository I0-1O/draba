-- Migration 019: shares table + token migration.
--
-- Each timeline can have many shares (one per configured view). The existing
-- timelines.share_token rows are migrated into shares rows so that any links
-- already in circulation continue to work. The share_token column on timelines
-- is left in place until all code references are removed (a follow-up migration
-- will drop it once it is no longer used by the legacy handler).

CREATE TABLE shares (
  id             TEXT PRIMARY KEY,
  timeline_id    TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  view_type      TEXT NOT NULL DEFAULT 'gantt',
  view_config    TEXT NOT NULL DEFAULT '{}',
  password_hash  TEXT,
  expires_at     DATETIME,
  created_by     TEXT NOT NULL REFERENCES team_members(id),
  created_at     DATETIME NOT NULL,
  last_viewed_at DATETIME,
  view_count     INTEGER NOT NULL DEFAULT 0,
  revoked_at     DATETIME
);

CREATE INDEX idx_shares_timeline_id ON shares(timeline_id);
CREATE INDEX idx_shares_token       ON shares(token);

-- Migrate every existing timeline's share_token into a shares row so that
-- any existing share links keep working. We pick the first team_member row
-- for the timeline's team as created_by (a stable stand-in for the original
-- creator, which was not recorded).
INSERT INTO shares (id, timeline_id, token, view_type, view_config, created_by, created_at)
SELECT
  lower(hex(randomblob(16))),
  t.id,
  t.share_token,
  'gantt',
  '{}',
  (SELECT tm.id FROM team_members tm WHERE tm.team_id = t.team_id AND tm.archived_at IS NULL ORDER BY tm.joined_at LIMIT 1),
  datetime('now')
FROM timelines t
WHERE t.share_token IS NOT NULL
  AND t.share_token != ''
  AND EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.team_id = t.team_id AND tm.archived_at IS NULL
  );
