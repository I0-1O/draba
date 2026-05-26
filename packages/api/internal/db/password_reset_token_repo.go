package db

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// PasswordResetTokenRepo manages password_reset_tokens rows.
type PasswordResetTokenRepo struct {
	db *sqlx.DB
}

// NewPasswordResetTokenRepo returns a PasswordResetTokenRepo backed by db.
func NewPasswordResetTokenRepo(db *sqlx.DB) *PasswordResetTokenRepo {
	return &PasswordResetTokenRepo{db: db}
}

// hashToken returns the hex-encoded SHA-256 of the raw token.
func hashToken(rawToken string) string {
	h := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(h[:])
}

// Create inserts a new password reset token. The raw token value is hashed;
// only the hash is stored. Returns the new row.
func (r *PasswordResetTokenRepo) Create(id, userID, rawToken string, expiresAt time.Time) (*models.PasswordResetToken, error) {
	row := &models.PasswordResetToken{
		ID:        id,
		UserID:    userID,
		TokenHash: hashToken(rawToken),
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}
	_, err := r.db.NamedExec(`
		INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
		VALUES (:id, :user_id, :token_hash, :expires_at, :created_at)
	`, row)
	if err != nil {
		return nil, fmt.Errorf("creating password reset token: %w", err)
	}
	return row, nil
}

// GetValid returns the token row matching rawToken only when it has not
// expired and has not been used. Returns sql.ErrNoRows (wrapped) when
// no valid token matches.
func (r *PasswordResetTokenRepo) GetValid(rawToken string) (*models.PasswordResetToken, error) {
	hash := hashToken(rawToken)
	var t models.PasswordResetToken
	err := r.db.Get(&t, `
		SELECT * FROM password_reset_tokens
		WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
	`, hash, time.Now())
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("getting valid reset token: %w", sql.ErrNoRows)
		}
		return nil, fmt.Errorf("getting valid reset token: %w", err)
	}
	return &t, nil
}

// MarkUsed sets used_at to now, preventing token reuse.
func (r *PasswordResetTokenRepo) MarkUsed(id string) error {
	_, err := r.db.Exec(
		`UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`,
		time.Now(), id,
	)
	if err != nil {
		return fmt.Errorf("marking reset token used: %w", err)
	}
	return nil
}
