package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// EventRepo is the persistence layer for Event records.
type EventRepo struct {
	db *sqlx.DB
}

// NewEventRepo returns an EventRepo backed by db.
func NewEventRepo(db *sqlx.DB) *EventRepo {
	return &EventRepo{db: db}
}

// Create inserts a new Event row.
func (r *EventRepo) Create(event *models.Event) error {
	_, err := r.db.NamedExec(`
		INSERT INTO events (
			id, team_id, title, description, icon, color,
			start_at, end_at, all_day, status_id, parent_event_id,
			percent_complete, location, url, rrule,
			caldav_uid, google_event_id,
			created_by, created_at, updated_at
		) VALUES (
			:id, :team_id, :title, :description, :icon, :color,
			:start_at, :end_at, :all_day, :status_id, :parent_event_id,
			:percent_complete, :location, :url, :rrule,
			:caldav_uid, :google_event_id,
			:created_by, :created_at, :updated_at
		)
	`, event)
	if err != nil {
		return fmt.Errorf("creating event: %w", err)
	}
	return nil
}

// GetByID fetches an Event by primary key. Returns sql.ErrNoRows (wrapped)
// when no row matches.
func (r *EventRepo) GetByID(id string) (*models.Event, error) {
	var e models.Event
	err := r.db.Get(&e, `SELECT * FROM events WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting event: %w", err)
	}
	return &e, nil
}

// Update replaces all mutable fields on an existing Event row.
func (r *EventRepo) Update(event *models.Event) error {
	_, err := r.db.NamedExec(`
		UPDATE events SET
			title            = :title,
			description      = :description,
			icon             = :icon,
			color            = :color,
			start_at         = :start_at,
			end_at           = :end_at,
			all_day          = :all_day,
			status_id        = :status_id,
			parent_event_id  = :parent_event_id,
			percent_complete = :percent_complete,
			location         = :location,
			url              = :url,
			rrule            = :rrule,
			updated_at       = :updated_at
		WHERE id = :id
	`, event)
	if err != nil {
		return fmt.Errorf("updating event: %w", err)
	}
	return nil
}

// Delete permanently removes an event row.
func (r *EventRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM events WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting event: %w", err)
	}
	return nil
}

// ListByTeam returns non-archived events for a team. When from or to are
// non-nil they bound the query: events whose start_at falls within [from, to]
// inclusive are returned.
func (r *EventRepo) ListByTeam(teamID string, from, to *time.Time) ([]*models.Event, error) {
	query := `SELECT * FROM events WHERE team_id = ? AND archived_at IS NULL`
	args := []any{teamID}

	if from != nil {
		query += ` AND start_at >= ?`
		args = append(args, from)
	}
	if to != nil {
		query += ` AND start_at <= ?`
		args = append(args, to)
	}
	query += ` ORDER BY start_at ASC`

	events := make([]*models.Event, 0)
	if err := r.db.Select(&events, query, args...); err != nil {
		return nil, fmt.Errorf("listing events: %w", err)
	}
	return events, nil
}
