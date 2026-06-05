// Package db contains the persistence layer for draba.
package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ShareRepo is the persistence layer for Share records.
type ShareRepo struct {
	db *sqlx.DB
}

// NewShareRepo returns a ShareRepo backed by db.
func NewShareRepo(db *sqlx.DB) *ShareRepo {
	return &ShareRepo{db: db}
}

// Create inserts a new Share row.
func (r *ShareRepo) Create(s *models.Share) error {
	_, err := r.db.NamedExec(`
		INSERT INTO shares (
			id, timeline_id, token, view_type, view_config,
			created_by, created_at, view_count
		) VALUES (
			:id, :timeline_id, :token, :view_type, :view_config,
			:created_by, :created_at, :view_count
		)
	`, s)
	if err != nil {
		return fmt.Errorf("creating share: %w", err)
	}
	return nil
}

// GetByID fetches a Share by primary key. Returns sql.ErrNoRows (wrapped) when
// no row matches.
func (r *ShareRepo) GetByID(id string) (*models.Share, error) {
	var s models.Share
	if err := r.db.Get(&s, `SELECT * FROM shares WHERE id = ?`, id); err != nil {
		return nil, fmt.Errorf("getting share: %w", err)
	}
	return &s, nil
}

// GetByToken fetches a Share by its public token. Returns sql.ErrNoRows
// (wrapped) when no row matches.
func (r *ShareRepo) GetByToken(token string) (*models.Share, error) {
	var s models.Share
	if err := r.db.Get(&s, `SELECT * FROM shares WHERE token = ?`, token); err != nil {
		return nil, fmt.Errorf("getting share by token: %w", err)
	}
	return &s, nil
}

// ListByTimeline returns all non-revoked shares for a timeline, ordered by
// creation time ascending.
func (r *ShareRepo) ListByTimeline(timelineID string) ([]*models.Share, error) {
	out := make([]*models.Share, 0)
	if err := r.db.Select(&out,
		`SELECT * FROM shares WHERE timeline_id = ? ORDER BY created_at ASC`,
		timelineID,
	); err != nil {
		return nil, fmt.Errorf("listing shares: %w", err)
	}
	return out, nil
}

// Update writes view_config and updated fields for an existing share.
func (r *ShareRepo) Update(s *models.Share) error {
	_, err := r.db.NamedExec(`
		UPDATE shares SET
			view_type   = :view_type,
			view_config = :view_config
		WHERE id = :id
	`, s)
	if err != nil {
		return fmt.Errorf("updating share: %w", err)
	}
	return nil
}

// Delete permanently removes a share row.
func (r *ShareRepo) Delete(id string) error {
	if _, err := r.db.Exec(`DELETE FROM shares WHERE id = ?`, id); err != nil {
		return fmt.Errorf("deleting share: %w", err)
	}
	return nil
}

// RecordView increments view_count and sets last_viewed_at to now for a share.
func (r *ShareRepo) RecordView(id string) error {
	_, err := r.db.Exec(
		`UPDATE shares SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("recording share view: %w", err)
	}
	return nil
}
