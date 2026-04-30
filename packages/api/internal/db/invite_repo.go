package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

type InviteRepo struct {
	db *sqlx.DB
}

func NewInviteRepo(db *sqlx.DB) *InviteRepo {
	return &InviteRepo{db: db}
}

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

func (r *InviteRepo) MarkAccepted(id string) error {
	now := time.Now()
	_, err := r.db.Exec(`UPDATE invites SET accepted_at = ? WHERE id = ?`, now, id)
	if err != nil {
		return fmt.Errorf("marking invite accepted: %w", err)
	}
	return nil
}
