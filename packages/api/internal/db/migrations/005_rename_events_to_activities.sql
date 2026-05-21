-- Rename domain entity: events → activities.
--
-- This is a hard cutover — no aliases. SQLite 3.26+ automatically updates
-- foreign-key references in other tables when a referenced table is renamed,
-- so the FK in event_assignments pointing to events(id) becomes activities(id)
-- after step 1, before we rename the child tables in steps 2 and 3.
--
-- Rollback SQL (if needed without a DB restore):
--   ALTER TABLE activities RENAME COLUMN parent_activity_id TO parent_event_id;
--   ALTER TABLE activities RENAME TO events;
--   ALTER TABLE activity_tags RENAME TO event_tags;
--   ALTER TABLE activity_assignments RENAME TO event_assignments;

ALTER TABLE events RENAME TO activities;
ALTER TABLE event_tags RENAME TO activity_tags;
ALTER TABLE event_assignments RENAME TO activity_assignments;
ALTER TABLE activities RENAME COLUMN parent_event_id TO parent_activity_id;
ALTER TABLE activity_tags RENAME COLUMN event_id TO activity_id;
ALTER TABLE activity_assignments RENAME COLUMN event_id TO activity_id;
