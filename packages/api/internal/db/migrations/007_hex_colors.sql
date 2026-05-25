-- Convert identity color IDs (stored by migration 006) back to hex values.
-- Hex is the durable ground truth; palette names are UI-only conveniences.
-- Storing hex lets the palette evolve without requiring a DB migration.

UPDATE activities SET color = '#288C9B' WHERE color = 'teal';
UPDATE activities SET color = '#06B6D4' WHERE color = 'cyan';
UPDATE activities SET color = '#3B82F6' WHERE color = 'blue';
UPDATE activities SET color = '#6366F1' WHERE color = 'indigo';
UPDATE activities SET color = '#8B5CF6' WHERE color = 'violet';
UPDATE activities SET color = '#A855F7' WHERE color = 'purple';
UPDATE activities SET color = '#EC4899' WHERE color = 'pink';
UPDATE activities SET color = '#F43F5E' WHERE color = 'rose';
UPDATE activities SET color = '#EF4444' WHERE color = 'red';
UPDATE activities SET color = '#F97316' WHERE color = 'orange';
UPDATE activities SET color = '#F59E0B' WHERE color = 'amber';
UPDATE activities SET color = '#EAB308' WHERE color = 'yellow';
UPDATE activities SET color = '#84CC16' WHERE color = 'lime';
UPDATE activities SET color = '#22C55E' WHERE color = 'green';
UPDATE activities SET color = '#64748B' WHERE color = 'slate';
UPDATE activities SET color = '#78716C' WHERE color = 'stone';

UPDATE team_members SET color = '#288C9B' WHERE color = 'teal';
UPDATE team_members SET color = '#06B6D4' WHERE color = 'cyan';
UPDATE team_members SET color = '#3B82F6' WHERE color = 'blue';
UPDATE team_members SET color = '#6366F1' WHERE color = 'indigo';
UPDATE team_members SET color = '#8B5CF6' WHERE color = 'violet';
UPDATE team_members SET color = '#A855F7' WHERE color = 'purple';
UPDATE team_members SET color = '#EC4899' WHERE color = 'pink';
UPDATE team_members SET color = '#F43F5E' WHERE color = 'rose';
UPDATE team_members SET color = '#EF4444' WHERE color = 'red';
UPDATE team_members SET color = '#F97316' WHERE color = 'orange';
UPDATE team_members SET color = '#F59E0B' WHERE color = 'amber';
UPDATE team_members SET color = '#EAB308' WHERE color = 'yellow';
UPDATE team_members SET color = '#84CC16' WHERE color = 'lime';
UPDATE team_members SET color = '#22C55E' WHERE color = 'green';
UPDATE team_members SET color = '#64748B' WHERE color = 'slate';
UPDATE team_members SET color = '#78716C' WHERE color = 'stone';
