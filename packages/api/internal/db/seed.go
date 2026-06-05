package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"
)

// SeedSampleDataIfEmpty loads sql into the database, but only when it is empty
// (no users). This makes a freshly-wiped dev/test instance come up populated
// with the canonical sample dataset, while never clobbering a database that
// already holds data. It is gated by the caller (DRABA_SEED_SAMPLE_DATA) and is
// strictly a pre-launch convenience — it must stay off in any real deployment.
//
// Returns true when seeding ran, false when the database was already populated.
func SeedSampleDataIfEmpty(database *sqlx.DB, sql string) (bool, error) {
	var users int
	if err := database.Get(&users, `SELECT COUNT(*) FROM users`); err != nil {
		return false, fmt.Errorf("checking whether db is empty: %w", err)
	}
	if users > 0 {
		return false, nil
	}
	if _, err := database.Exec(sql); err != nil {
		return false, fmt.Errorf("seeding sample data: %w", err)
	}
	return true, nil
}
