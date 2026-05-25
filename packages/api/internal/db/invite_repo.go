package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// InviteRepo is the persistence layer for team invitation tokens.
type InviteRepo struct {
	db *sqlx.DB
}

// NewInviteRepo returns an InviteRepo backed by db.
func NewInviteRepo(db *sqlx.DB) *InviteRepo {
	return &InviteRepo{db: db}
}

// Create inserts an invite row. The caller is responsible for generating
// the token and setting an appropriate ExpiresAt.
func (r *InviteRepo) Create(inv *models.Invite) error {
	_, err := r.db.NamedExec(`
		INSERT INTO invites (id, team_id, email, token, role, invited_by, expires_at, created_at)
		VALUES (:id, :team_id, :email, :token, :role, :invited_by, :expires_at, :created_at)
	`, inv)
	if err != nil {
		return fmt.Errorf("creating invite: %w", err)
	}
	return nil
}

// GetValid returns an invite that is not expired and not yet accepted.
func (r *InviteRepo) GetValid(token string) (*models.Invite, error) {
	var inv models.Invite
	err := r.db.Get(&inv, `
		SELECT * FROM invites
		WHERE token = ? AND accepted_at IS NULL AND expires_at > ?
	`, token, time.Now())
	if err != nil {
		return nil, fmt.Errorf("getting invite: %w", err)
	}
	return &inv, nil
}

// MarkAccepted stamps accepted_at on the invite. Idempotent at the DB layer:
// re-marking simply overwrites the timestamp.
func (r *InviteRepo) MarkAccepted(id string) error {
	now := time.Now()
	_, err := r.db.Exec(`UPDATE invites SET accepted_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return fmt.Errorf("marking invite accepted: %w", err)
	}
	return nil
}

// ListByTeam returns all pending (not yet accepted, not expired) invites for a
// team, ordered by creation date descending so the newest invite is first.
func (r *InviteRepo) ListByTeam(teamID string) ([]*models.Invite, error) {
	var invites []*models.Invite
	err := r.db.Select(&invites, `
		SELECT * FROM invites
		WHERE team_id = ? AND accepted_at IS NULL
		ORDER BY created_at DESC
	`, teamID)
	if err != nil {
		return nil, fmt.Errorf("listing invites: %w", err)
	}
	return invites, nil
}

// DeleteByID hard-deletes an invite row. Used by admins to revoke a pending
// invite before it is accepted.
func (r *InviteRepo) DeleteByID(id string) error {
	_, err := r.db.Exec(`DELETE FROM invites WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting invite: %w", err)
	}
	return nil
}

// GetByToken fetches an invite by its token field regardless of expiry or
// accepted status. Used for invite-link validation where the caller needs to
// check freshness itself.
func (r *InviteRepo) GetByToken(token string) (*models.Invite, error) {
	var inv models.Invite
	err := r.db.Get(&inv, `SELECT * FROM invites WHERE token = ?`, token)
	if err != nil {
		return nil, fmt.Errorf("getting invite by token: %w", err)
	}
	return &inv, nil
}
