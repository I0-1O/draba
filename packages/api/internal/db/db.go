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

	if _, err = database.Exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); err != nil {
		return nil, fmt.Errorf("configuring database: %w", err)
	}

	return database, nil
}
