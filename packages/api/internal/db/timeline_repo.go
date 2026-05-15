package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// TimelineRepo is the persistence layer for Timeline records and their access
// control entries.
type TimelineRepo struct {
	db *sqlx.DB
}

// NewTimelineRepo returns a TimelineRepo backed by db.
func NewTimelineRepo(db *sqlx.DB) *TimelineRepo {
	return &TimelineRepo{db: db}
}

// Create inserts a new Timeline row.
func (r *TimelineRepo) Create(t *models.Timeline) error {
	_, err := r.db.NamedExec(`
		INSERT INTO timelines (
			id, team_id, name, start_date, end_date,
			visibility, share_token, ical_token,
			created_by, created_at, updated_at
		) VALUES (
			:id, :team_id, :name, :start_date, :end_date,
			:visibility, :share_token, :ical_token,
			:created_by, :created_at, :updated_at
		)
	`, t)
	if err != nil {
		return fmt.Errorf("creating timeline: %w", err)
	}
	return nil
}

// GetByID fetches a non-archived Timeline by primary key. Returns
// sql.ErrNoRows (wrapped) when no row matches or the row is archived.
func (r *TimelineRepo) GetByID(id string) (*models.Timeline, error) {
	var t models.Timeline
	err := r.db.Get(&t, `SELECT * FROM timelines WHERE id = ? AND archived_at IS NULL`, id)
	if err != nil {
		return nil, fmt.Errorf("getting timeline: %w", err)
	}
	return &t, nil
}

// GetByShareToken fetches a non-archived Timeline by its public share token.
// Returns sql.ErrNoRows (wrapped) when no row matches.
func (r *TimelineRepo) GetByShareToken(token string) (*models.Timeline, error) {
	var t models.Timeline
	err := r.db.Get(&t, `SELECT * FROM timelines WHERE share_token = ? AND archived_at IS NULL`, token)
	if err != nil {
		return nil, fmt.Errorf("getting timeline by share token: %w", err)
	}
	return &t, nil
}

// ListByTeam returns all non-archived timelines for a team ordered by
// creation date descending.
func (r *TimelineRepo) ListByTeam(teamID string) ([]*models.Timeline, error) {
	ts := make([]*models.Timeline, 0)
	err := r.db.Select(&ts,
		`SELECT * FROM timelines WHERE team_id = ? AND archived_at IS NULL ORDER BY created_at DESC`,
		teamID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing timelines: %w", err)
	}
	return ts, nil
}

// HasAccess reports whether userID is listed in timeline_access for the given
// timeline. Returns false (not an error) when the row is absent.
func (r *TimelineRepo) HasAccess(timelineID, userID string) (bool, error) {
	var count int
	err := r.db.Get(&count,
		`SELECT COUNT(*) FROM timeline_access WHERE timeline_id = ? AND user_id = ?`,
		timelineID, userID,
	)
	if err != nil {
		return false, fmt.Errorf("checking timeline access: %w", err)
	}
	return count > 0, nil
}

// GrantAccess inserts a timeline_access row. It is a no-op if the row
// already exists.
func (r *TimelineRepo) GrantAccess(timelineID, userID string) error {
	_, err := r.db.Exec(
		`INSERT OR IGNORE INTO timeline_access (timeline_id, user_id) VALUES (?, ?)`,
		timelineID, userID,
	)
	if err != nil {
		return fmt.Errorf("granting timeline access: %w", err)
	}
	return nil
}

// RevokeAccess removes a timeline_access row. It is a no-op when the row
// does not exist.
func (r *TimelineRepo) RevokeAccess(timelineID, userID string) error {
	_, err := r.db.Exec(
		`DELETE FROM timeline_access WHERE timeline_id = ? AND user_id = ?`,
		timelineID, userID,
	)
	if err != nil {
		return fmt.Errorf("revoking timeline access: %w", err)
	}
	return nil
}
