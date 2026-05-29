-- Migration 016: Add notes column to activities
-- notes is separate from description (short text); notes is a longer multi-line field.
ALTER TABLE activities ADD COLUMN notes TEXT;
