-- Phase 10.1.1: add description, notes, and archived_at to teams.
ALTER TABLE teams ADD COLUMN description TEXT;
ALTER TABLE teams ADD COLUMN notes       TEXT;
ALTER TABLE teams ADD COLUMN archived_at DATETIME;
