package db_test

import (
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
