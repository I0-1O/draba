package db

import (
	"errors"
	"fmt"
	"strings"

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
		INSERT INTO teams (id, name, slug, created_at, updated_at)
		VALUES (:id, :name, :slug, :created_at, :updated_at)
	`, team)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return ErrDuplicateName
		}
		return fmt.Errorf("creating team: %w", err)
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

// AddMember inserts a team_members row.
func (r *TeamRepo) AddMember(m *models.TeamMember) error {
	_, err := r.db.NamedExec(`
		INSERT INTO team_members (team_id, user_id, role, color, joined_at)
		VALUES (:team_id, :user_id, :role, :color, :joined_at)
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

// ListMembers returns all members of a team joined with their user details,
// ordered by the time they joined.
func (r *TeamRepo) ListMembers(teamID string) ([]*models.TeamMemberWithUser, error) {
	var members []*models.TeamMemberWithUser
	err := r.db.Select(&members, `
		SELECT
			tm.team_id, tm.user_id, tm.role, tm.color, tm.joined_at,
			u.email, u.display_name, u.avatar_url
		FROM team_members tm
		JOIN users u ON u.id = tm.user_id
		WHERE tm.team_id = ?
		ORDER BY tm.joined_at ASC
	`, teamID)
	if err != nil {
		return nil, fmt.Errorf("listing team members: %w", err)
	}
	return members, nil
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
