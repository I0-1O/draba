package db

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// InstanceSettingsRepo reads and writes instance-level configuration from
// the instance_settings table. All values are stored as text; callers
// are responsible for encoding/decoding structured values.
type InstanceSettingsRepo struct {
	db *sqlx.DB
}

// NewInstanceSettingsRepo returns an InstanceSettingsRepo backed by db.
func NewInstanceSettingsRepo(db *sqlx.DB) *InstanceSettingsRepo {
	return &InstanceSettingsRepo{db: db}
}

// Get returns the value for key. Returns ("", nil) when the key has no row.
func (r *InstanceSettingsRepo) Get(key string) (string, error) {
	var s models.InstanceSetting
	err := r.db.Get(&s, `SELECT * FROM instance_settings WHERE key = ?`, key)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", nil
		}
		return "", fmt.Errorf("getting instance setting %q: %w", key, err)
	}
	return s.Value, nil
}

// Set upserts a key/value pair.
func (r *InstanceSettingsRepo) Set(key, value string) error {
	_, err := r.db.Exec(
		`INSERT INTO instance_settings (key, value, updated_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("setting instance setting %q: %w", key, err)
	}
	return nil
}

// Delete removes a key. No-op when the key does not exist.
func (r *InstanceSettingsRepo) Delete(key string) error {
	_, err := r.db.Exec(`DELETE FROM instance_settings WHERE key = ?`, key)
	if err != nil {
		return fmt.Errorf("deleting instance setting %q: %w", key, err)
	}
	return nil
}

// DeletePrefix removes all keys with the given prefix.
func (r *InstanceSettingsRepo) DeletePrefix(prefix string) error {
	_, err := r.db.Exec(`DELETE FROM instance_settings WHERE key LIKE ?`, prefix+"%")
	if err != nil {
		return fmt.Errorf("deleting instance settings with prefix %q: %w", prefix, err)
	}
	return nil
}

// List returns all settings.
func (r *InstanceSettingsRepo) List() ([]*models.InstanceSetting, error) {
	var rows []*models.InstanceSetting
	if err := r.db.Select(&rows, `SELECT * FROM instance_settings ORDER BY key ASC`); err != nil {
		return nil, fmt.Errorf("listing instance settings: %w", err)
	}
	return rows, nil
}
