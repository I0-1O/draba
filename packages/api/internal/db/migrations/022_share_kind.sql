-- Migration 022: shares.kind discriminator + ICS feed scope columns.
--
-- Phase 13.4: a Calendar share is a subscribable ICS feed, not a frozen view
-- snapshot. Both flavors live in the shares table, discriminated by kind:
--   kind = 'view' — frozen view-config share served at /s/{token} (13.1–13.3)
--   kind = 'ics'  — live calendar feed served at GET /shares/{token}.ics
--
-- ICS rows carry scope ('timeline' = every activity, 'member' = one member's
-- assigned activities) plus member_id when scope = 'member'. They never carry
-- a view_config, filter, or password — the token is the secret.
--
-- member_id uses ON DELETE CASCADE (unlike the RESTRICT FKs of migration 011):
-- a per-member feed is meaningless once the member row is gone, so the feed
-- row is dropped with the member rather than blocking the delete.

ALTER TABLE shares ADD COLUMN kind TEXT NOT NULL DEFAULT 'view';
ALTER TABLE shares ADD COLUMN scope TEXT;
ALTER TABLE shares ADD COLUMN member_id TEXT REFERENCES team_members(id) ON DELETE CASCADE;
