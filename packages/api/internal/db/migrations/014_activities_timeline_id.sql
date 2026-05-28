ALTER TABLE activities ADD COLUMN timeline_id TEXT REFERENCES timelines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activities_timeline_id ON activities(timeline_id);
