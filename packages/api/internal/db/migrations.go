package db

import (
	"embed"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/jmoiron/sqlx"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migrate applies any unapplied SQL migration files in order. It is idempotent.
func Migrate(database *sqlx.DB) error {
	if _, err := database.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
		)
	`); err != nil {
		return fmt.Errorf("ensuring schema_migrations table: %w", err)
	}

	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("reading migrations: %w", err)
	}

	type migration struct {
		version int
		name    string
	}
	var pending []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		vStr := strings.SplitN(e.Name(), "_", 2)[0]
		v, err := strconv.Atoi(vStr)
		if err != nil {
			continue
		}
		pending = append(pending, migration{version: v, name: e.Name()})
	}
	sort.Slice(pending, func(i, j int) bool { return pending[i].version < pending[j].version })

	for _, m := range pending {
		var count int
		if err := database.Get(&count, `SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, m.version); err != nil {
			return fmt.Errorf("checking migration %d: %w", m.version, err)
		}
		if count > 0 {
			continue
		}

		sql, err := migrationFiles.ReadFile("migrations/" + m.name)
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", m.name, err)
		}

		if _, err := database.Exec(string(sql)); err != nil {
			return fmt.Errorf("applying migration %s: %w", m.name, err)
		}

		if _, err := database.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, m.version); err != nil {
			return fmt.Errorf("recording migration %d: %w", m.version, err)
		}
	}

	return nil
}
