package db

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ErrDuplicateName is returned by TeamRepo.Create when the generated slug
// collides with an existing team's slug (UNIQUE constraint on teams.slug).
var ErrDuplicateName = errors.New("team name already taken")

// TeamRepo is the persistence layer for Team records and their membership
// join table.
type TeamRepo struct {
	db *sqlx.DB
}

// NewTeamRepo returns a TeamRepo backed by db.
func NewTeamRepo(db *sqlx.DB) *TeamRepo {
	return &TeamRepo{db: db}
}

// Create inserts a new Team row. Returns ErrDuplicateName if the slug is
// already taken.
func (r *TeamRepo) Create(team *models.Team) error {
	_, err := r.db.NamedExec(`
		INSERT INTO teams (id, name, slug, description, notes, color, icon, created_at, updated_at)
		VALUES (:id, :name, :slug, :description, :notes, :color, :icon, :created_at, :updated_at)
	`, team)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return ErrDuplicateName
		}
		return fmt.Errorf("creating team: %w", err)
	}
	return nil
}

// Update writes mutable team fields (name, slug, description, notes, color,
// icon, updated_at). It does not touch archived_at or created_at.
func (r *TeamRepo) Update(team *models.Team) error {
	_, err := r.db.NamedExec(`
		UPDATE teams
		SET name = :name, slug = :slug, description = :description, notes = :notes,
		    color = :color, icon = :icon, updated_at = :updated_at
		WHERE id = :id
	`, team)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return ErrDuplicateName
		}
		return fmt.Errorf("updating team: %w", err)
	}
	return nil
}

// SetArchived sets or clears the archived_at timestamp on a team.
func (r *TeamRepo) SetArchived(id string, at *time.Time) error {
	_, err := r.db.Exec(`UPDATE teams SET archived_at = ?, updated_at = ? WHERE id = ?`,
		at, time.Now(), id)
	if err != nil {
		return fmt.Errorf("setting team archived: %w", err)
	}
	return nil
}

// GetByID fetches a Team by primary key.
func (r *TeamRepo) GetByID(id string) (*models.Team, error) {
	var t models.Team
	err := r.db.Get(&t, `SELECT * FROM teams WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting team: %w", err)
	}
	return &t, nil
}

// AddMember inserts a team_members row. m.ID must be pre-populated by the caller.
func (r *TeamRepo) AddMember(m *models.TeamMember) error {
	_, err := r.db.NamedExec(`
		INSERT INTO team_members (id, team_id, user_id, display_name, role, color, icon, joined_at)
		VALUES (:id, :team_id, :user_id, :display_name, :role, :color, :icon, :joined_at)
	`, m)
	if err != nil {
		return fmt.Errorf("adding team member: %w", err)
	}
	return nil
}

// GetMember returns the team_members row for a given (team, user) pair.
func (r *TeamRepo) GetMember(teamID, userID string) (*models.TeamMember, error) {
	var m models.TeamMember
	err := r.db.Get(&m, `
		SELECT * FROM team_members WHERE team_id = ? AND user_id = ?
	`, teamID, userID)
	if err != nil {
		return nil, fmt.Errorf("getting team member: %w", err)
	}
	return &m, nil
}

// ListMembers returns active (non-archived) members of a team, including
// login-less Participants. A LEFT JOIN handles Participants who have no users
// row; COALESCE prefers the per-team display_name override, then falls back to users.
func (r *TeamRepo) ListMembers(teamID string) ([]*models.TeamMemberWithUser, error) {
	return r.listMembers(teamID, false)
}

// ListMembersAll returns all members of a team, including inactivated members.
func (r *TeamRepo) ListMembersAll(teamID string) ([]*models.TeamMemberWithUser, error) {
	return r.listMembers(teamID, true)
}

func (r *TeamRepo) listMembers(teamID string, includeArchived bool) ([]*models.TeamMemberWithUser, error) {
	var members []*models.TeamMemberWithUser
	query := `
		SELECT
			tm.id, tm.team_id, tm.user_id, tm.role, tm.color, tm.icon, tm.joined_at, tm.archived_at,
			COALESCE(u.email, '')                          AS email,
			COALESCE(tm.display_name, u.display_name, '') AS display_name,
			u.avatar_url
		FROM team_members tm
		LEFT JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = ?`
	if !includeArchived {
		query += ` AND tm.archived_at IS NULL`
	}
	query += ` ORDER BY tm.joined_at ASC`
	if err := r.db.Select(&members, query, teamID); err != nil {
		return nil, fmt.Errorf("listing team members: %w", err)
	}
	return members, nil
}

// ListByUserID returns all teams the given user belongs to, ordered by
// creation date ascending. When includeArchived is false (the default),
// archived teams are excluded.
func (r *TeamRepo) ListByUserID(userID string, includeArchived bool) ([]*models.Team, error) {
	teams := make([]*models.Team, 0)
	query := `
		SELECT t.* FROM teams t
		JOIN team_members tm ON tm.team_id = t.id
		WHERE tm.user_id = ?`
	if !includeArchived {
		query += ` AND t.archived_at IS NULL`
	}
	query += ` ORDER BY t.created_at ASC`
	if err := r.db.Select(&teams, query, userID); err != nil {
		return nil, fmt.Errorf("listing teams for user: %w", err)
	}
	return teams, nil
}

// ListAll returns every team in the system, optionally including archived ones.
// Used by superadmin callers who need visibility across all teams.
func (r *TeamRepo) ListAll(includeArchived bool) ([]*models.Team, error) {
	teams := make([]*models.Team, 0)
	query := `SELECT * FROM teams`
	if !includeArchived {
		query += ` WHERE archived_at IS NULL`
	}
	query += ` ORDER BY created_at ASC`
	if err := r.db.Select(&teams, query); err != nil {
		return nil, fmt.Errorf("listing all teams: %w", err)
	}
	return teams, nil
}

// Count returns the total number of teams.
func (r *TeamRepo) Count() (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM teams`)
	if err != nil {
		return 0, fmt.Errorf("counting teams: %w", err)
	}
	return count, nil
}

// GetMemberByID fetches a team_members row by its primary key. Unlike
// GetMember (which looks up by team+userID pair), this is the canonical
// lookup used by member-scoped routes that receive a memberId path param.
func (r *TeamRepo) GetMemberByID(memberID string) (*models.TeamMemberWithUser, error) {
	var m models.TeamMemberWithUser
	err := r.db.Get(&m, `
		SELECT
			tm.id, tm.team_id, tm.user_id, tm.role, tm.color, tm.icon, tm.joined_at, tm.archived_at,
			COALESCE(u.email, '')                          AS email,
			COALESCE(tm.display_name, u.display_name, '') AS display_name,
			u.avatar_url
		FROM team_members tm
		LEFT JOIN users u ON u.id = tm.user_id
		WHERE tm.id = ?
	`, memberID)
	if err != nil {
		return nil, fmt.Errorf("getting team member by id: %w", err)
	}
	return &m, nil
}

// UpdateMember applies mutable identity and role fields to a team_members row.
// Only non-nil arguments are written; nil fields retain their current values.
func (r *TeamRepo) UpdateMember(memberID string, displayName, color, icon, role *string) error {
	// Fetch current values so we can apply the partial update.
	type row struct {
		DisplayName *string `db:"display_name"`
		Color       *string `db:"color"`
		Icon        *string `db:"icon"`
		Role        string  `db:"role"`
	}
	var cur row
	if err := r.db.Get(&cur, `SELECT display_name, color, icon, role FROM team_members WHERE id = ?`, memberID); err != nil {
		return fmt.Errorf("fetching member for update: %w", err)
	}
	if displayName != nil {
		cur.DisplayName = displayName
	}
	if color != nil {
		cur.Color = color
	}
	if icon != nil {
		cur.Icon = icon
	}
	if role != nil {
		cur.Role = *role
	}
	_, err := r.db.Exec(`
		UPDATE team_members SET display_name = ?, color = ?, icon = ?, role = ? WHERE id = ?
	`, cur.DisplayName, cur.Color, cur.Icon, cur.Role, memberID)
	if err != nil {
		return fmt.Errorf("updating team member: %w", err)
	}
	return nil
}

// DeleteMember removes a team_members row. The caller is responsible for
// verifying that the member is not the last admin before calling this, and
// must delete the member's timeline_access rows first (RESTRICT FK).
func (r *TeamRepo) DeleteMember(memberID string) error {
	_, err := r.db.Exec(`DELETE FROM team_members WHERE id = ?`, memberID)
	if err != nil {
		return fmt.Errorf("deleting team member: %w", err)
	}
	return nil
}

// CountMemberAssignments returns how many activity_assignments rows reference
// this team member. Callers use this count to block hard-delete when history exists.
func (r *TeamRepo) CountMemberAssignments(memberID string) (int, error) {
	var count int
	err := r.db.Get(&count, `
		SELECT COUNT(*) FROM activity_assignments WHERE team_member_id = ?
	`, memberID)
	if err != nil {
		return 0, fmt.Errorf("counting member assignments: %w", err)
	}
	return count, nil
}

// DeleteMemberTimelineAccess removes all timeline_access entries for a member.
// Must be called before DeleteMember; the RESTRICT FK on
// timeline_access.team_member_id blocks the team_members deletion otherwise.
func (r *TeamRepo) DeleteMemberTimelineAccess(memberID string) error {
	_, err := r.db.Exec(`DELETE FROM timeline_access WHERE team_member_id = ?`, memberID)
	if err != nil {
		return fmt.Errorf("deleting member timeline access: %w", err)
	}
	return nil
}

// SetMemberArchived sets or clears archived_at on a team_members row.
func (r *TeamRepo) SetMemberArchived(memberID string, at *time.Time) error {
	_, err := r.db.Exec(`UPDATE team_members SET archived_at = ? WHERE id = ?`, at, memberID)
	if err != nil {
		return fmt.Errorf("setting member archived: %w", err)
	}
	return nil
}

// CountAdmins counts non-archived admin members of a team. Used to enforce
// the "cannot remove last admin" constraint.
func (r *TeamRepo) CountAdmins(teamID string) (int, error) {
	var count int
	err := r.db.Get(&count, `
		SELECT COUNT(*) FROM team_members
		WHERE team_id = ? AND role = 'admin' AND archived_at IS NULL
	`, teamID)
	if err != nil {
		return 0, fmt.Errorf("counting admins: %w", err)
	}
	return count, nil
}

// CountTeamsForUser returns how many teams a user belongs to. Used to enforce
// the "single team" constraint for hard deletion.
func (r *TeamRepo) CountTeamsForUser(userID string) (int, error) {
	var count int
	err := r.db.Get(&count, `
		SELECT COUNT(*) FROM team_members WHERE user_id = ? AND archived_at IS NULL
	`, userID)
	if err != nil {
		return 0, fmt.Errorf("counting user teams: %w", err)
	}
	return count, nil
}

// GetMemberStats computes activity and timeline counts for a team member.
func (r *TeamRepo) GetMemberStats(memberID string) (*models.MemberStats, error) {
	now := time.Now()
	var stats models.MemberStats

	// Timeline counts via timeline_access.
	if err := r.db.Get(&stats.ActiveTimelines, `
		SELECT COUNT(*) FROM timeline_access ta
		JOIN timelines t ON t.id = ta.timeline_id
		WHERE ta.team_member_id = ? AND t.archived_at IS NULL
	`, memberID); err != nil {
		return nil, fmt.Errorf("counting active timelines: %w", err)
	}
	if err := r.db.Get(&stats.ArchivedTimelines, `
		SELECT COUNT(*) FROM timeline_access ta
		JOIN timelines t ON t.id = ta.timeline_id
		WHERE ta.team_member_id = ? AND t.archived_at IS NOT NULL
	`, memberID); err != nil {
		return nil, fmt.Errorf("counting archived timelines: %w", err)
	}

	// Activity counts from activity_assignments.
	rows, err := r.db.Query(`
		SELECT
			COALESCE(SUM(CASE WHEN a.archived_at IS NOT NULL                                                     THEN 1 ELSE 0 END), 0) AS archived,
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.end_at   <  ?                                     THEN 1 ELSE 0 END), 0) AS past_due,
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.start_at <= ? AND a.end_at >= ?                   THEN 1 ELSE 0 END), 0) AS running,
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.start_at >  ?                                     THEN 1 ELSE 0 END), 0) AS upcoming
		FROM activity_assignments aa
		JOIN activities a ON a.id = aa.activity_id
		WHERE aa.team_member_id = ?
	`, now, now, now, now, memberID)
	if err != nil {
		return nil, fmt.Errorf("computing activity stats: %w", err)
	}
	defer rows.Close()
	if rows.Next() {
		if err := rows.Scan(&stats.ArchivedActivities, &stats.PastDue, &stats.Running, &stats.Upcoming); err != nil {
			return nil, fmt.Errorf("scanning activity stats: %w", err)
		}
	}

	return &stats, nil
}

// GetUserStats aggregates activity and timeline counts across all of a user's
// team memberships. Used by GET /users/me/stats for the profile page.
func (r *TeamRepo) GetUserStats(userID string) (*models.MemberStats, error) {
	now := time.Now()
	var stats models.MemberStats

	if err := r.db.Get(&stats.ActiveTimelines, `
		SELECT COUNT(*) FROM timeline_access ta
		JOIN timelines t ON t.id = ta.timeline_id
		JOIN team_members tm ON tm.id = ta.team_member_id
		WHERE tm.user_id = ? AND t.archived_at IS NULL
	`, userID); err != nil {
		return nil, fmt.Errorf("counting active timelines: %w", err)
	}
	if err := r.db.Get(&stats.ArchivedTimelines, `
		SELECT COUNT(*) FROM timeline_access ta
		JOIN timelines t ON t.id = ta.timeline_id
		JOIN team_members tm ON tm.id = ta.team_member_id
		WHERE tm.user_id = ? AND t.archived_at IS NOT NULL
	`, userID); err != nil {
		return nil, fmt.Errorf("counting archived timelines: %w", err)
	}

	rows, err := r.db.Query(`
		SELECT
			COALESCE(SUM(CASE WHEN a.archived_at IS NOT NULL                                   THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.end_at   <  ?                   THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.start_at <= ? AND a.end_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN a.archived_at IS NULL AND a.start_at >  ?                   THEN 1 ELSE 0 END), 0)
		FROM activity_assignments aa
		JOIN activities a ON a.id = aa.activity_id
		JOIN team_members tm ON tm.id = aa.team_member_id
		WHERE tm.user_id = ?
	`, now, now, now, now, userID)
	if err != nil {
		return nil, fmt.Errorf("computing activity stats: %w", err)
	}
	defer rows.Close()
	if rows.Next() {
		if err := rows.Scan(&stats.ArchivedActivities, &stats.PastDue, &stats.Running, &stats.Upcoming); err != nil {
			return nil, fmt.Errorf("scanning activity stats: %w", err)
		}
	}

	return &stats, nil
}

// GetMemberAllTeams returns all team memberships for a user (across all teams).
// Used to populate the "Teams" section of the Member Edit Modal.
func (r *TeamRepo) GetMemberAllTeams(userID string) ([]*models.TeamMemberWithUser, error) {
	var members []*models.TeamMemberWithUser
	err := r.db.Select(&members, `
		SELECT
			tm.id, tm.team_id, tm.user_id, tm.role, tm.color, tm.icon, tm.joined_at, tm.archived_at,
			COALESCE(u.email, '')                          AS email,
			COALESCE(tm.display_name, u.display_name, '') AS display_name,
			u.avatar_url
		FROM team_members tm
		LEFT JOIN users u ON u.id = tm.user_id
		WHERE tm.user_id = ?
		ORDER BY tm.joined_at ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("getting member all teams: %w", err)
	}
	return members, nil
}

// SetInviteLinkToken sets the reusable invite link token on a team. Passing
// nil clears it (revoking the link).
func (r *TeamRepo) SetInviteLinkToken(teamID string, token *string) error {
	_, err := r.db.Exec(
		`UPDATE teams SET invite_link_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		token, teamID,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return fmt.Errorf("invite link token collision: %w", err)
		}
		return fmt.Errorf("setting invite link token: %w", err)
	}
	return nil
}

// GetByInviteLinkToken looks up a team by its invite_link_token. Returns
// sql.ErrNoRows (wrapped) when no matching team is found.
func (r *TeamRepo) GetByInviteLinkToken(token string) (*models.Team, error) {
	var t models.Team
	err := r.db.Get(&t, `
		SELECT * FROM teams WHERE invite_link_token = ? AND archived_at IS NULL
	`, token)
	if err != nil {
		return nil, fmt.Errorf("getting team by invite link: %w", err)
	}
	return &t, nil
}
