package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// SavedFilterRepo is the persistence layer for SavedFilter records.
type SavedFilterRepo struct {
	db *sqlx.DB
}

// NewSavedFilterRepo returns a SavedFilterRepo backed by db.
func NewSavedFilterRepo(db *sqlx.DB) *SavedFilterRepo {
	return &SavedFilterRepo{db: db}
}

// Create inserts a new SavedFilter row.
func (r *SavedFilterRepo) Create(f *models.SavedFilter) error {
	_, err := r.db.NamedExec(`
		INSERT INTO saved_filters (
			id, team_id, user_id, name, definition, is_team_filter, created_at, updated_at
		) VALUES (
			:id, :team_id, :user_id, :name, :definition, :is_team_filter, :created_at, :updated_at
		)
	`, f)
	if err != nil {
		return fmt.Errorf("creating saved filter: %w", err)
	}
	return nil
}

// GetByID fetches a SavedFilter by primary key. Returns sql.ErrNoRows
// (wrapped) when no row matches.
func (r *SavedFilterRepo) GetByID(id string) (*models.SavedFilter, error) {
	var f models.SavedFilter
	err := r.db.Get(&f, `SELECT * FROM saved_filters WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting saved filter: %w", err)
	}
	return &f, nil
}

// ListByTeamUser returns all saved filters owned by userID within teamID,
// plus all team-promoted filters (is_team_filter = 1) regardless of owner,
// ordered by creation time ascending.
func (r *SavedFilterRepo) ListByTeamUser(teamID, userID string) ([]*models.SavedFilter, error) {
	fs := make([]*models.SavedFilter, 0)
	err := r.db.Select(&fs,
		`SELECT * FROM saved_filters WHERE team_id = ? AND (user_id = ? OR is_team_filter = 1) ORDER BY created_at ASC`,
		teamID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing saved filters: %w", err)
	}
	return fs, nil
}

// Update writes name, definition, is_team_filter, and updated_at for an existing row.
func (r *SavedFilterRepo) Update(f *models.SavedFilter) error {
	_, err := r.db.NamedExec(`
		UPDATE saved_filters
		SET name = :name, definition = :definition, is_team_filter = :is_team_filter, updated_at = :updated_at
		WHERE id = :id
	`, f)
	if err != nil {
		return fmt.Errorf("updating saved filter: %w", err)
	}
	return nil
}

// Delete removes the row with the given id. No-op when the row is absent.
func (r *SavedFilterRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM saved_filters WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting saved filter: %w", err)
	}
	return nil
}
