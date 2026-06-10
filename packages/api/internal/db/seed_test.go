package db_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/db"
	sampledata "github.com/I0-1O/draba/packages/api/sample_data"
)

// TestSeedSampleDataIfEmpty verifies the embedded sample data loads into an
// empty database and that the seed is a no-op once the database is populated.
func TestSeedSampleDataIfEmpty(t *testing.T) {
	database, err := db.Open(":memory:")
	require.NoError(t, err)
	defer database.Close()
	require.NoError(t, db.Migrate(database))

	sql, err := sampledata.SQL()
	require.NoError(t, err)
	require.Contains(t, sql, "INSERT INTO shares", "embedded SQL should include the shares seed")

	// First run: empty DB → seeds.
	seeded, err := db.SeedSampleDataIfEmpty(database, sql)
	require.NoError(t, err)
	require.True(t, seeded, "expected seeding to run on an empty database")

	var users, shares int
	require.NoError(t, database.Get(&users, `SELECT COUNT(*) FROM users`))
	require.NoError(t, database.Get(&shares, `SELECT COUNT(*) FROM shares`))
	require.Equal(t, 13, users)
	// 8 view shares + 2 ICS calendar feeds (Phase 13.4).
	require.Equal(t, 10, shares)

	// Second run: populated DB → no-op, counts unchanged.
	seeded, err = db.SeedSampleDataIfEmpty(database, sql)
	require.NoError(t, err)
	require.False(t, seeded, "expected seeding to be skipped on a populated database")

	require.NoError(t, database.Get(&users, `SELECT COUNT(*) FROM users`))
	require.Equal(t, 13, users, "seed must not duplicate rows on a populated database")
}
