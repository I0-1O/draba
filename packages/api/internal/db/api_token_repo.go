package db

import (
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// APITokenRepo is the persistence layer for APIToken records.
type APITokenRepo struct {
	db *sqlx.DB
}

// NewAPITokenRepo returns an APITokenRepo backed by db.
func NewAPITokenRepo(db *sqlx.DB) *APITokenRepo {
	return &APITokenRepo{db: db}
}

// Create inserts a new APIToken row. The caller is responsible for hashing
// the raw token value before passing it in.
func (r *APITokenRepo) Create(t *models.APIToken) error {
	_, err := r.db.NamedExec(`
		INSERT INTO api_tokens (id, user_id, name, token_hash, scope, last_used_at, created_at, revoked_at)
		VALUES (:id, :user_id, :name, :token_hash, :scope, :last_used_at, :created_at, :revoked_at)
	`, t)
	if err != nil {
		return fmt.Errorf("creating api token: %w", err)
	}
	return nil
}

// ListByUser returns every token (active and revoked) owned by userID,
// newest first.
func (r *APITokenRepo) ListByUser(userID string) ([]*models.APIToken, error) {
	ts := make([]*models.APIToken, 0)
	err := r.db.Select(&ts,
		`SELECT * FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing api tokens: %w", err)
	}
	return ts, nil
}

// GetByID fetches a single token row.
func (r *APITokenRepo) GetByID(id string) (*models.APIToken, error) {
	var t models.APIToken
	err := r.db.Get(&t, `SELECT * FROM api_tokens WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting api token: %w", err)
	}
	return &t, nil
}

// GetByHash looks up an active (non-revoked) token by its hash. Returns
// sql.ErrNoRows (wrapped) when no matching active token exists.
func (r *APITokenRepo) GetByHash(hash string) (*models.APIToken, error) {
	var t models.APIToken
	err := r.db.Get(&t,
		`SELECT * FROM api_tokens WHERE token_hash = ? AND revoked_at IS NULL`,
		hash,
	)
	if err != nil {
		return nil, fmt.Errorf("getting api token by hash: %w", err)
	}
	return &t, nil
}

// Revoke marks a token as revoked. The row is preserved so the listing UI
// can show "Revoked on <date>" rather than the token silently disappearing.
func (r *APITokenRepo) Revoke(id string) error {
	res, err := r.db.Exec(
		`UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("revoking api token: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("revoking api token: %w", err)
	}
	if n == 0 {
		return fmt.Errorf("revoking api token: no active token with id %q", id)
	}
	return nil
}

// TouchLastUsed updates last_used_at to now. Called on every successful
// authentication; failures are logged but do not block the request.
func (r *APITokenRepo) TouchLastUsed(id string) error {
	_, err := r.db.Exec(
		`UPDATE api_tokens SET last_used_at = ? WHERE id = ?`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("touching api token: %w", err)
	}
	return nil
}
