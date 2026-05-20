package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// UserPreferenceRepo is the persistence layer for UserPreference records.
type UserPreferenceRepo struct {
	db *sqlx.DB
}

// NewUserPreferenceRepo returns a UserPreferenceRepo backed by db.
func NewUserPreferenceRepo(db *sqlx.DB) *UserPreferenceRepo {
	return &UserPreferenceRepo{db: db}
}

// List returns all preferences for the given user and timeline scope.
// Pass "" for timelineID to retrieve global preferences.
func (r *UserPreferenceRepo) List(userID, timelineID string) ([]*models.UserPreference, error) {
	prefs := make([]*models.UserPreference, 0)
	err := r.db.Select(&prefs,
		`SELECT * FROM user_preferences WHERE user_id = ? AND timeline_id = ? ORDER BY key ASC`,
		userID, timelineID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing user preferences: %w", err)
	}
	return prefs, nil
}

// Upsert inserts or updates a single preference identified by
// (user_id, timeline_id, key). On conflict the value and updated_at are
// replaced; the id column keeps the winning row's original value.
func (r *UserPreferenceRepo) Upsert(p *models.UserPreference) error {
	_, err := r.db.Exec(`
		INSERT INTO user_preferences (id, user_id, timeline_id, key, value, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, timeline_id, key) DO UPDATE
		SET value      = excluded.value,
		    updated_at = excluded.updated_at
	`, p.ID, p.UserID, p.TimelineID, p.Key, p.Value, p.UpdatedAt.UTC().Format(time.RFC3339))
	if err != nil {
		return fmt.Errorf("upserting user preference: %w", err)
	}
	return nil
}
