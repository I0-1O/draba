package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ActivityRepo is the persistence layer for Activity records.
type ActivityRepo struct {
	db *sqlx.DB
}

// NewActivityRepo returns an ActivityRepo backed by db.
func NewActivityRepo(db *sqlx.DB) *ActivityRepo {
	return &ActivityRepo{db: db}
}

// Create inserts a new Activity row.
func (r *ActivityRepo) Create(activity *models.Activity) error {
	_, err := r.db.NamedExec(`
		INSERT INTO activities (
			id, timeline_id, title, description, icon, color,
			start_at, end_at, all_day, status_id, parent_activity_id,
			percent_complete, location, url, rrule,
			caldav_uid, google_event_id,
			created_by, created_at, updated_at
		) VALUES (
			:id, :timeline_id, :title, :description, :icon, :color,
			:start_at, :end_at, :all_day, :status_id, :parent_activity_id,
			:percent_complete, :location, :url, :rrule,
			:caldav_uid, :google_event_id,
			:created_by, :created_at, :updated_at
		)
	`, activity)
	if err != nil {
		return fmt.Errorf("creating activity: %w", err)
	}
	return nil
}

// GetByID fetches an Activity by primary key. Returns sql.ErrNoRows (wrapped)
// when no row matches.
func (r *ActivityRepo) GetByID(id string) (*models.Activity, error) {
	var a models.Activity
	err := r.db.Get(&a, `SELECT * FROM activities WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting activity: %w", err)
	}
	return &a, nil
}

// Update replaces all mutable fields on an existing Activity row.
func (r *ActivityRepo) Update(activity *models.Activity) error {
	_, err := r.db.NamedExec(`
		UPDATE activities SET
			title              = :title,
			description        = :description,
			notes              = :notes,
			icon               = :icon,
			color              = :color,
			start_at           = :start_at,
			end_at             = :end_at,
			all_day            = :all_day,
			status_id          = :status_id,
			parent_activity_id = :parent_activity_id,
			percent_complete   = :percent_complete,
			location           = :location,
			url                = :url,
			rrule              = :rrule,
			updated_at         = :updated_at
		WHERE id = :id
	`, activity)
	if err != nil {
		return fmt.Errorf("updating activity: %w", err)
	}
	return nil
}

// Delete permanently removes an activity row.
func (r *ActivityRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM activities WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting activity: %w", err)
	}
	return nil
}

// ClearParentRefs clears parent_activity_id on all activities that reference id
// as their parent. Called before deleting or archiving the parent so children
// do not retain a dangling reference.
func (r *ActivityRepo) ClearParentRefs(id string) error {
	_, err := r.db.Exec(
		`UPDATE activities SET parent_activity_id = NULL, updated_at = ? WHERE parent_activity_id = ?`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("clearing parent refs for %s: %w", id, err)
	}
	return nil
}

// SetArchived sets or clears archived_at on an activity. Pass a non-nil time
// to archive; pass nil to unarchive.
func (r *ActivityRepo) SetArchived(id string, at *time.Time) error {
	_, err := r.db.Exec(
		`UPDATE activities SET archived_at = ?, updated_at = ? WHERE id = ?`,
		at, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("setting activity archived_at: %w", err)
	}
	return nil
}

// SetAssignments replaces all activity_assignments for an activity with the
// provided member IDs. An empty slice removes all assignments.
func (r *ActivityRepo) SetAssignments(activityID string, memberIDs []string) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning assignment transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(`DELETE FROM activity_assignments WHERE activity_id = ?`, activityID); err != nil {
		return fmt.Errorf("clearing activity assignments: %w", err)
	}

	for _, memberID := range memberIDs {
		if _, err = tx.Exec(
			`INSERT INTO activity_assignments (activity_id, team_member_id) VALUES (?, ?)`,
			activityID, memberID,
		); err != nil {
			return fmt.Errorf("inserting activity assignment: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing activity assignments: %w", err)
	}
	return nil
}

// GetAssignments returns the team_member_ids assigned to an activity.
func (r *ActivityRepo) GetAssignments(activityID string) ([]string, error) {
	var ids []string
	err := r.db.Select(&ids,
		`SELECT team_member_id FROM activity_assignments WHERE activity_id = ?`, activityID,
	)
	if err != nil {
		return nil, fmt.Errorf("getting activity assignments: %w", err)
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

// SetTags replaces all activity_tags for an activity with the provided tag
// IDs. An empty slice removes all tag associations.
func (r *ActivityRepo) SetTags(activityID string, tagIDs []string) error {
	tx, err := r.db.Beginx()
	if err != nil {
		return fmt.Errorf("beginning tag transaction: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(`DELETE FROM activity_tags WHERE activity_id = ?`, activityID); err != nil {
		return fmt.Errorf("clearing activity tags: %w", err)
	}

	for _, tagID := range tagIDs {
		if _, err = tx.Exec(
			`INSERT INTO activity_tags (activity_id, tag_id) VALUES (?, ?)`,
			activityID, tagID,
		); err != nil {
			return fmt.Errorf("inserting activity tag: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("committing activity tags: %w", err)
	}
	return nil
}

// GetTags returns the tag IDs associated with an activity.
func (r *ActivityRepo) GetTags(activityID string) ([]string, error) {
	var ids []string
	err := r.db.Select(&ids,
		`SELECT tag_id FROM activity_tags WHERE activity_id = ?`, activityID,
	)
	if err != nil {
		return nil, fmt.Errorf("getting activity tags: %w", err)
	}
	if ids == nil {
		ids = []string{}
	}
	return ids, nil
}

// ListByTimeline returns activities for a specific timeline. When
// includeArchived is false archived rows are excluded. When from or to are
// non-nil they bound the query by start_at.
// AssignedMemberIDs is populated via a second query.
func (r *ActivityRepo) ListByTimeline(timelineID string, from, to *time.Time, includeArchived bool) ([]*models.Activity, error) {
	query := `SELECT * FROM activities WHERE timeline_id = ?`
	args := []any{timelineID}
	if !includeArchived {
		query += ` AND archived_at IS NULL`
	}

	if from != nil {
		query += ` AND start_at >= ?`
		args = append(args, from)
	}
	if to != nil {
		query += ` AND start_at <= ?`
		args = append(args, to)
	}
	query += ` ORDER BY start_at ASC`

	acts := make([]*models.Activity, 0)
	if err := r.db.Select(&acts, query, args...); err != nil {
		return nil, fmt.Errorf("listing activities: %w", err)
	}
	if len(acts) == 0 {
		return acts, nil
	}

	// Initialise AssignedMemberIDs and TagIDs to empty slices so JSON fields are
	// always arrays (never null) even when an activity has no assignments or tags.
	ids := make([]string, len(acts))
	byID := make(map[string]*models.Activity, len(acts))
	for i, a := range acts {
		a.AssignedMemberIDs = []string{}
		a.TagIDs = []string{}
		ids[i] = a.ID
		byID[a.ID] = a
	}

	asnQuery, asnArgs, err := sqlx.In(
		`SELECT activity_id, team_member_id FROM activity_assignments WHERE activity_id IN (?)`,
		ids,
	)
	if err != nil {
		return nil, fmt.Errorf("building assignments query: %w", err)
	}
	asnQuery = r.db.Rebind(asnQuery)

	type assignment struct {
		ActivityID   string `db:"activity_id"`
		TeamMemberID string `db:"team_member_id"`
	}
	var assignments []assignment
	if err := r.db.Select(&assignments, asnQuery, asnArgs...); err != nil {
		return nil, fmt.Errorf("listing activity assignments: %w", err)
	}
	for _, a := range assignments {
		if act, ok := byID[a.ActivityID]; ok {
			act.AssignedMemberIDs = append(act.AssignedMemberIDs, a.TeamMemberID)
		}
	}

	tagQuery, tagArgs, err := sqlx.In(
		`SELECT activity_id, tag_id FROM activity_tags WHERE activity_id IN (?)`,
		ids,
	)
	if err != nil {
		return nil, fmt.Errorf("building tags query: %w", err)
	}
	tagQuery = r.db.Rebind(tagQuery)

	type activityTag struct {
		ActivityID string `db:"activity_id"`
		TagID      string `db:"tag_id"`
	}
	var actTags []activityTag
	if err := r.db.Select(&actTags, tagQuery, tagArgs...); err != nil {
		return nil, fmt.Errorf("listing activity tags: %w", err)
	}
	for _, at := range actTags {
		if act, ok := byID[at.ActivityID]; ok {
			act.TagIDs = append(act.TagIDs, at.TagID)
		}
	}

	return acts, nil
}
