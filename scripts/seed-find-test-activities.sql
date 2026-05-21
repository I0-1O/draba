-- seed-find-test-activities.sql
--
-- Creates 5 events that exercise every match field in the Find (Phase 8.5)
-- feature: title, description, assignee display name, and parent event title.
--
-- Events are positioned inside the first non-archived timeline so they appear
-- in the Gantt view regardless of which timeline you've set up.
--
-- Run against the test database:
--   sqlite3 /path/to/draba.db < scripts/seed-find-test-activities.sql
--
-- To remove the test events afterwards, see the DELETE block at the bottom.

BEGIN;

-- ── Event 1: TITLE match ─────────────────────────────────────────────────────
-- Search "Alpha" → this event highlights.

INSERT INTO activities (id, team_id, title, description, color, start_at, end_at, all_day, created_by)
SELECT
    lower(hex(randomblob(16))),
    t.id,
    'Alpha Release Planning',
    'Coordinate the Alpha build handoff to QA.',
    '#6366f1',
    datetime(tl.start_date, '+7 days'),
    datetime(tl.start_date, '+14 days'),
    1,
    u.id
FROM teams t
JOIN users u ON u.is_superadmin = 1
JOIN timelines tl ON tl.team_id = t.id AND tl.archived_at IS NULL
ORDER BY tl.created_at ASC
LIMIT 1;


-- ── Event 2: DESCRIPTION match ───────────────────────────────────────────────
-- Search "retrospective" → title doesn't match, but description does.
-- The "why matched: description" tooltip should appear on hover.

INSERT INTO activities (id, team_id, title, description, color, start_at, end_at, all_day, created_by)
SELECT
    lower(hex(randomblob(16))),
    t.id,
    'Sprint Review',
    'End-of-sprint retrospective and demo for stakeholders.',
    '#10b981',
    datetime(tl.start_date, '+21 days'),
    datetime(tl.start_date, '+21 days'),
    1,
    u.id
FROM teams t
JOIN users u ON u.is_superadmin = 1
JOIN timelines tl ON tl.team_id = t.id AND tl.archived_at IS NULL
ORDER BY tl.created_at ASC
LIMIT 1;


-- ── Event 3: ASSIGNEE match ───────────────────────────────────────────────────
-- Assigned to the first team member.
-- Search by that member's display name → the "why matched: assignee: <name>"
-- tooltip should appear on hover.

INSERT INTO activities (id, team_id, title, description, color, start_at, end_at, all_day, created_by)
SELECT
    lower(hex(randomblob(16))),
    t.id,
    'Design Handoff',
    'Deliver finalized designs to engineering.',
    '#f59e0b',
    datetime(tl.start_date, '+28 days'),
    datetime(tl.start_date, '+35 days'),
    1,
    u.id
FROM teams t
JOIN users u ON u.is_superadmin = 1
JOIN timelines tl ON tl.team_id = t.id AND tl.archived_at IS NULL
ORDER BY tl.created_at ASC
LIMIT 1;

INSERT INTO activity_assignments (event_id, team_member_id)
SELECT e.id, tm.id
FROM activities e
JOIN team_members tm ON tm.team_id = e.team_id
WHERE e.title = 'Design Handoff'
  AND e.archived_at IS NULL
ORDER BY e.created_at DESC, tm.joined_at ASC
LIMIT 1;


-- ── Event 4: PARENT event ─────────────────────────────────────────────────────
-- Parent of Event 5 below.

INSERT INTO activities (id, team_id, title, description, color, start_at, end_at, all_day, created_by)
SELECT
    lower(hex(randomblob(16))),
    t.id,
    'Roadmap Review',
    'Quarterly roadmap sync with leadership.',
    '#288C9B',
    datetime(tl.start_date, '+42 days'),
    datetime(tl.start_date, '+56 days'),
    1,
    u.id
FROM teams t
JOIN users u ON u.is_superadmin = 1
JOIN timelines tl ON tl.team_id = t.id AND tl.archived_at IS NULL
ORDER BY tl.created_at ASC
LIMIT 1;


-- ── Event 5: PARENT TITLE match ───────────────────────────────────────────────
-- Child of Event 4. The title "Competitive Research" doesn't contain "Roadmap",
-- but the parent title does. Search "Roadmap" → both events highlight; this
-- one should show "why matched: parent: Roadmap Review" on hover.

INSERT INTO activities (id, team_id, title, description, color, start_at, end_at, all_day, parent_activity_id, created_by)
SELECT
    lower(hex(randomblob(16))),
    parent.team_id,
    'Competitive Research',
    'Analysis of rival products ahead of the roadmap review.',
    '#ec4899',
    datetime(tl.start_date, '+42 days'),
    datetime(tl.start_date, '+49 days'),
    1,
    parent.id,
    parent.created_by
FROM activities parent
JOIN timelines tl ON tl.team_id = parent.team_id AND tl.archived_at IS NULL
WHERE parent.title = 'Roadmap Review'
  AND parent.archived_at IS NULL
ORDER BY parent.created_at DESC, tl.created_at ASC
LIMIT 1;

COMMIT;

-- ── Cleanup (run separately when done) ────────────────────────────────────────
-- DELETE FROM activities
-- WHERE title IN (
--     'Alpha Release Planning',
--     'Sprint Review',
--     'Design Handoff',
--     'Roadmap Review',
--     'Competitive Research'
-- );
