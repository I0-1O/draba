-- Flush all sample-data tables in FK-safe (reverse dependency) order.
-- Tables NOT flushed: schema_migrations, instance_settings, saved_filters.

DELETE FROM activity_assignments;
DELETE FROM activity_tags;
DELETE FROM activities;
DELETE FROM tags;
DELETE FROM statuses;
DELETE FROM status_template_items;
DELETE FROM status_templates;
DELETE FROM shares;
DELETE FROM timeline_access;
DELETE FROM timelines;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM user_preferences;
DELETE FROM password_reset_tokens;
DELETE FROM invites;
DELETE FROM api_tokens;
DELETE FROM calendar_connections;
DELETE FROM users;
