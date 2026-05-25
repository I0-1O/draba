-- Phase 10.1.2: member lifecycle, account inactivation, reusable invite links.
--
-- Changes:
--   team_members → add archived_at (member inactivation)
--   users        → add archived_at (account-level inactivation)
--   teams        → add invite_link_token (reusable join link)
--
-- SQLite cannot add a UNIQUE column via ALTER TABLE, so invite_link_token
-- is added as a plain column and then enforced via a partial unique index
-- that excludes NULL rows (so "no token" rows don't conflict).
ALTER TABLE team_members ADD COLUMN archived_at DATETIME;
ALTER TABLE users        ADD COLUMN archived_at DATETIME;
ALTER TABLE teams        ADD COLUMN invite_link_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_invite_link_token
    ON teams (invite_link_token)
    WHERE invite_link_token IS NOT NULL;
