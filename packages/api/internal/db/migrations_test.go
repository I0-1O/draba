package db_test

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
)

func TestMigrate_Idempotent(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)

	require.NoError(t, db.Migrate(database), "first run")
	require.NoError(t, db.Migrate(database), "second run (idempotent)")

	// Verify all expected tables exist.
	tables := []string{
		"users", "teams", "team_members", "team_statuses",
		"invites", "api_tokens", "activities", "activity_tags",
		"activity_assignments", "timelines", "timeline_access",
		"calendar_connections",
	}
	for _, table := range tables {
		var count int
		err := database.Get(&count,
			`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, table)
		require.NoError(t, err)
		assert.Equal(t, 1, count, "table %q should exist", table)
	}

	// Verify identity columns added by migration 006.
	identityColumns := []struct{ table, col string }{
		{"team_members", "icon"},
		{"teams", "color"},
		{"teams", "icon"},
		{"timelines", "color"},
		{"timelines", "icon"},
	}
	for _, tc := range identityColumns {
		var colCount int
		err := database.Get(&colCount,
			`SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?`, tc.table, tc.col)
		require.NoError(t, err)
		assert.Equal(t, 1, colCount, "column %q.%q should exist", tc.table, tc.col)
	}
}

// TestMigrate_006_007_ColorConversion verifies the two-step color conversion:
// migration 006 maps legacy hex values to palette name IDs, and migration 007
// maps those name IDs back to canonical hex values. The net effect is that
// stored colors are always hex strings after a full migration run.
func TestMigrate_006_007_ColorConversion(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)

	// Apply migrations 001–005 to build the base schema without identity changes.
	for _, fname := range []string{
		"001_initial_schema.sql",
		"002_saved_filters.sql",
		"003_rbac_participants.sql",
		"004_user_preferences.sql",
		"005_rename_events_to_activities.sql",
	} {
		sql, err := os.ReadFile("migrations/" + fname)
		require.NoError(t, err, "reading %s", fname)
		_, err = database.Exec(string(sql))
		require.NoError(t, err, "applying %s", fname)
	}

	// Seed minimal rows to satisfy FK constraints.
	// Column names match the post-003 schema: team_members has id + joined_at;
	// activities has created_by (not creator_id); DEFAULT columns are omitted.
	_, err = database.Exec(
		`INSERT INTO users (id, email, password_hash, display_name)
		 VALUES ('u1', 'test@example.com', 'hash', 'Test')`)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO teams (id, name, slug) VALUES ('t1', 'Team', 'team')`)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO team_members (id, team_id, user_id, role, color)
		 VALUES ('m1', 't1', 'u1', 'admin', '#F29E4C')`)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO activities (id, team_id, created_by, title, start_at, end_at, color)
		 VALUES ('a1', 't1', 'u1', 'Act', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '#288C9B')`)
	require.NoError(t, err)

	// Apply migration 006: legacy hex → palette name ID.
	sql006, err := os.ReadFile("migrations/006_identity_fields.sql")
	require.NoError(t, err)
	_, err = database.Exec(string(sql006))
	require.NoError(t, err)

	var actColor, memberColor string
	require.NoError(t, database.Get(&actColor, `SELECT color FROM activities WHERE id='a1'`))
	assert.Equal(t, "teal", actColor, "migration 006: #288C9B → 'teal'")
	require.NoError(t, database.Get(&memberColor, `SELECT color FROM team_members WHERE id='m1'`))
	assert.Equal(t, "amber", memberColor, "migration 006: #F29E4C → 'amber'")

	// Apply migration 007: palette name ID → canonical hex.
	sql007, err := os.ReadFile("migrations/007_hex_colors.sql")
	require.NoError(t, err)
	_, err = database.Exec(string(sql007))
	require.NoError(t, err)

	require.NoError(t, database.Get(&actColor, `SELECT color FROM activities WHERE id='a1'`))
	assert.True(t, strings.HasPrefix(actColor, "#"), "migration 007: activity.color should be hex, got %q", actColor)
	assert.Equal(t, "#288C9B", actColor, "migration 007: 'teal' → '#288C9B'")

	require.NoError(t, database.Get(&memberColor, `SELECT color FROM team_members WHERE id='m1'`))
	assert.True(t, strings.HasPrefix(memberColor, "#"), "migration 007: member.color should be hex, got %q", memberColor)
	assert.Equal(t, "#F59E0B", memberColor, "migration 007: 'amber' → '#F59E0B'")
}

// TestMigrate_HexStorageRoundTrip confirms that after a full migration run the
// activities table stores and returns hex color values without modification.
func TestMigrate_HexStorageRoundTrip(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	require.NoError(t, db.Migrate(database))

	_, err = database.Exec(
		`INSERT INTO users (id, email, password_hash, display_name)
		 VALUES ('u1', 'rt@example.com', 'hash', 'RT')`)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO teams (id, name, slug) VALUES ('t1', 'Team', 'team-rt')`)
	require.NoError(t, err)
	_, err = database.Exec(
		`INSERT INTO activities (id, team_id, created_by, title, start_at, end_at, color)
		 VALUES ('a1', 't1', 'u1', 'Act', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '#3B82F6')`)
	require.NoError(t, err)

	var color string
	require.NoError(t, database.Get(&color, `SELECT color FROM activities WHERE id='a1'`))
	assert.Equal(t, "#3B82F6", color, "hex color should round-trip through storage unchanged")
	assert.True(t, strings.HasPrefix(color, "#"), "stored color should be a hex value")
}
