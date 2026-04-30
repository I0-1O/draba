package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"
	_ "modernc.org/sqlite"
)

// Open opens and configures a SQLite database at the given path.
func Open(dsn string) (*sqlx.DB, error) {
	database, err := sqlx.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	// SQLite performs better with a single writer connection.
	database.SetMaxOpenConns(1)

	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
	}
	for _, p := range pragmas {
		if _, err = database.Exec(p); err != nil {
			return nil, fmt.Errorf("configuring database (%s): %w", p, err)
		}
	}

	return database, nil
}
