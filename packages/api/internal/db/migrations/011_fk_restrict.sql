-- Phase 10.1.4: enforce ON DELETE RESTRICT on team_member_id FKs.
--
-- activity_assignments and timeline_access were created in migration 003 with
-- ON DELETE CASCADE on team_member_id. Cascade silently destroys historical
-- assignment data when a team_members row is deleted. This migration rebuilds
-- both tables with ON DELETE RESTRICT so that the database itself rejects any
-- attempt to delete a team_members row that still has child rows in either
-- table. The application-level guard in DELETE /teams/:id/members/:memberId
-- counts activity_assignments first and returns 409 MEMBER_HAS_ASSIGNMENTS,
-- which is the primary user-facing protection; RESTRICT is belt-and-suspenders.
--
-- timeline_access rows are not historical data (they are access-control entries)
-- so the DELETE endpoint deletes them before removing the team_members row,
-- satisfying the RESTRICT constraint for clean removals.
--
-- SQLite does not support ALTER TABLE … DROP CONSTRAINT, so a full
-- table rebuild is required to change FK actions.

-- 1. Stash activity_assignments data.
CREATE TABLE tmp_activity_assignments (
    activity_id    TEXT NOT NULL,
    team_member_id TEXT NOT NULL
);
INSERT INTO tmp_activity_assignments (activity_id, team_member_id)
    SELECT activity_id, team_member_id FROM activity_assignments;
DROP TABLE activity_assignments;

-- 2. Recreate activity_assignments with RESTRICT on team_member_id.
CREATE TABLE activity_assignments (
    activity_id    TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,
    PRIMARY KEY (activity_id, team_member_id)
);
INSERT INTO activity_assignments (activity_id, team_member_id)
    SELECT activity_id, team_member_id FROM tmp_activity_assignments;
DROP TABLE tmp_activity_assignments;

-- 3. Stash timeline_access data.
CREATE TABLE tmp_timeline_access (
    timeline_id    TEXT NOT NULL,
    team_member_id TEXT NOT NULL,
    role           TEXT NOT NULL
);
INSERT INTO tmp_timeline_access (timeline_id, team_member_id, role)
    SELECT timeline_id, team_member_id, role FROM timeline_access;
DROP TABLE timeline_access;

-- 4. Recreate timeline_access with RESTRICT on team_member_id.
CREATE TABLE timeline_access (
    timeline_id    TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
    team_member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE RESTRICT,
    role           TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    PRIMARY KEY (timeline_id, team_member_id)
);
INSERT INTO timeline_access (timeline_id, team_member_id, role)
    SELECT timeline_id, team_member_id, role FROM tmp_timeline_access;
DROP TABLE tmp_timeline_access;
