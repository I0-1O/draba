package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// UserRepo is the persistence layer for User records.
type UserRepo struct {
	db *sqlx.DB
}

// NewUserRepo returns a UserRepo backed by db.
func NewUserRepo(db *sqlx.DB) *UserRepo {
	return &UserRepo{db: db}
}

// Create inserts u. Returns an error if the email already exists
// (the users.email UNIQUE constraint surfaces as a wrapped driver error).
func (r *UserRepo) Create(u *models.User) error {
	_, err := r.db.NamedExec(`
		INSERT INTO users (id, email, password_hash, display_name, avatar_url, created_at, updated_at)
		VALUES (:id, :email, :password_hash, :display_name, :avatar_url, :created_at, :updated_at)
	`, u)
	if err != nil {
		return fmt.Errorf("creating user: %w", err)
	}
	return nil
}

// GetByEmail looks up a user by exact email match. Callers are expected to
// normalize (lowercase, trim) before calling. Returns sql.ErrNoRows wrapped
// when no row matches.
func (r *UserRepo) GetByEmail(email string) (*models.User, error) {
	var u models.User
	err := r.db.Get(&u, `SELECT * FROM users WHERE email = ?`, email)
	if err != nil {
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	return &u, nil
}

// GetByID looks up a user by primary key.
func (r *UserRepo) GetByID(id string) (*models.User, error) {
	var u models.User
	err := r.db.Get(&u, `SELECT * FROM users WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	return &u, nil
}

// Count returns the total number of users. Used by the registration flow
// to detect first-user bootstrap and to enforce tier user limits.
func (r *UserRepo) Count() (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM users`)
	if err != nil {
		return 0, fmt.Errorf("counting users: %w", err)
	}
	return count, nil
}
