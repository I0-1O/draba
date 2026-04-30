package db

import (
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

type UserRepo struct {
	db *sqlx.DB
}

func NewUserRepo(db *sqlx.DB) *UserRepo {
	return &UserRepo{db: db}
}

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

func (r *UserRepo) GetByEmail(email string) (*models.User, error) {
	var u models.User
	err := r.db.Get(&u, `SELECT * FROM users WHERE email = ?`, email)
	if err != nil {
		return nil, fmt.Errorf("getting user by email: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) GetByID(id string) (*models.User, error) {
	var u models.User
	err := r.db.Get(&u, `SELECT * FROM users WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting user by id: %w", err)
	}
	return &u, nil
}

func (r *UserRepo) Count() (int, error) {
	var count int
	err := r.db.Get(&count, `SELECT COUNT(*) FROM users`)
	if err != nil {
		return 0, fmt.Errorf("counting users: %w", err)
	}
	return count, nil
}
