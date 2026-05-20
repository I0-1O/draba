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

// SetAssignments replaces all event_assignments for an event with the
// provided member IDs. An empty slice removes all assignments.
func (r *EventRepo) SetAssignments(eventID string, memberIDs []string) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning assignment transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(`DELETE FROM event_assignments WHERE event_id = ?`, eventID); err != nil {
		return fmt.Errorf("clearing event assignments: %w", err)
	}

	for _, memberID := range memberIDs {
		if _, err = tx.Exec(
			`INSERT INTO event_assignments (event_id, team_member_id) VALUES (?, ?)`,
			eventID, memberID,
		); err != nil {
			return fmt.Errorf("inserting event assignment: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing event assignments: %w", err)
	}
	return nil
}

// GetAssignments returns the team_member_ids assigned to an event.
func (r *EventRepo) GetAssignments(eventID string) ([]string, error) {
	var ids []string
	err := r.db.Select(&ids,
		`SELECT team_member_id FROM event_assignments WHERE event_id = ?`, eventID,
	)
	if err != nil {
		return nil, fmt.Errorf("getting event assignments: %w", err)
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

// ListByTeam returns non-archived events for a team. When from or to are
// non-nil they bound the query: events whose start_at falls within [from, to]
// inclusive are returned. AssignedMemberIDs is populated via a second query.
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

	evts := make([]*models.Event, 0)
	if err := r.db.Select(&evts, query, args...); err != nil {
		return nil, fmt.Errorf("listing events: %w", err)
	}
	if len(evts) == 0 {
		return evts, nil
	}

	// Initialise AssignedMemberIDs to an empty slice so the JSON field is
	// always an array (never null) even when an event has no assignments.
	ids := make([]string, len(evts))
	byID := make(map[string]*models.Event, len(evts))
	for i, e := range evts {
		e.AssignedMemberIDs = []string{}
		ids[i] = e.ID
		byID[e.ID] = e
	}

	asnQuery, asnArgs, err := sqlx.In(
		`SELECT event_id, team_member_id FROM event_assignments WHERE event_id IN (?)`,
		ids,
	)
	if err != nil {
		return nil, fmt.Errorf("building assignments query: %w", err)
	}
	asnQuery = r.db.Rebind(asnQuery)

	type assignment struct {
		EventID      string `db:"event_id"`
		TeamMemberID string `db:"team_member_id"`
	}
	var assignments []assignment
	if err := r.db.Select(&assignments, asnQuery, asnArgs...); err != nil {
		return nil, fmt.Errorf("listing event assignments: %w", err)
	}
	for _, a := range assignments {
		if e, ok := byID[a.EventID]; ok {
			e.AssignedMemberIDs = append(e.AssignedMemberIDs, a.TeamMemberID)
		}
	}

	return evts, nil
}
