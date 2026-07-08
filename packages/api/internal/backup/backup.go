// Package backup implements verified SQLite database backups. Each backup
// is a hot copy taken with VACUUM INTO (consistent under WAL without
// blocking writers), integrity-checked at creation, and stored as a
// timestamped file in a well-known directory. The directory is the history
// record: the filename encodes when the backup ran and what triggered it,
// so no state about backups is kept inside the database being backed up.
package backup

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

// Engine produces and verifies backup files for one database driver.
// The only implementation today is the SQLite engine; the interface is the
// seam for future dump-based engines (MySQL/Postgres) when those drivers
// actually exist in the codebase.
type Engine interface {
	// Backup writes a standalone copy of the live database to destPath.
	// destPath must not already exist.
	Backup(ctx context.Context, destPath string) error
	// Verify checks that the file at path is a sound database. A backup
	// that fails Verify must never be kept.
	Verify(ctx context.Context, path string) error
}

// NewSQLiteEngine returns an Engine that copies the live SQLite database
// reached through db using VACUUM INTO and verifies copies with
// PRAGMA integrity_check.
func NewSQLiteEngine(db *sqlx.DB) Engine {
	return &sqliteEngine{db: db}
}

type sqliteEngine struct {
	db *sqlx.DB
}

// Backup takes a consistent snapshot without blocking concurrent writers:
// under WAL, VACUUM INTO reads a stable snapshot and produces a compacted,
// standalone, WAL-free file.
func (e *sqliteEngine) Backup(ctx context.Context, destPath string) error {
	if _, err := e.db.ExecContext(ctx, "VACUUM INTO ?", destPath); err != nil {
		return fmt.Errorf("vacuum into %s: %w", destPath, err)
	}
	return nil
}

// Verify opens the copy with its own connection and runs
// PRAGMA integrity_check against it — the check must run on the copy, not
// the live database, because the copy is what a restore would use.
func (e *sqliteEngine) Verify(ctx context.Context, path string) error {
	conn, err := sqlx.Open("sqlite", path)
	if err != nil {
		return fmt.Errorf("opening backup copy: %w", err)
	}
	defer func() { _ = conn.Close() }()

	var result string
	if err := conn.GetContext(ctx, &result, "PRAGMA integrity_check"); err != nil {
		return fmt.Errorf("integrity check: %w", err)
	}
	if result != "ok" {
		return fmt.Errorf("integrity check failed: %s", result)
	}
	return nil
}
