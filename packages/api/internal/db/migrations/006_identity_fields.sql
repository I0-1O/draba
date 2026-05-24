-- Add identity (color + icon) columns to teams, timelines, and team_members.
-- Also converts existing legacy hex color values in activities and team_members
-- to their corresponding identity color IDs so all color values are uniform.

ALTER TABLE team_members ADD COLUMN icon  TEXT;
ALTER TABLE teams        ADD COLUMN color TEXT;
ALTER TABLE teams        ADD COLUMN icon  TEXT;
ALTER TABLE timelines    ADD COLUMN color TEXT;
ALTER TABLE timelines    ADD COLUMN icon  TEXT;

-- Convert activities.color from legacy hex to identity color ID.
UPDATE activities SET color = 'teal'   WHERE color = '#288C9B';
UPDATE activities SET color = 'amber'  WHERE color = '#F29E4C';
UPDATE activities SET color = 'cyan'   WHERE color = '#5BC0DE';
UPDATE activities SET color = 'green'  WHERE color = '#2ECC71';
UPDATE activities SET color = 'violet' WHERE color = '#9B59B6';
UPDATE activities SET color = 'rose'   WHERE color = '#E74C3C';
UPDATE activities SET color = 'indigo' WHERE color = '#5C6BC0';
UPDATE activities SET color = 'lime'   WHERE color = '#8BC34A';

-- Convert team_members.color from legacy hex to identity color ID.
UPDATE team_members SET color = 'teal'   WHERE color = '#288C9B';
UPDATE team_members SET color = 'amber'  WHERE color = '#F29E4C';
UPDATE team_members SET color = 'cyan'   WHERE color = '#5BC0DE';
UPDATE team_members SET color = 'green'  WHERE color = '#2ECC71';
UPDATE team_members SET color = 'violet' WHERE color = '#9B59B6';
UPDATE team_members SET color = 'rose'   WHERE color = '#E74C3C';
UPDATE team_members SET color = 'indigo' WHERE color = '#5C6BC0';
UPDATE team_members SET color = 'lime'   WHERE color = '#8BC34A';
