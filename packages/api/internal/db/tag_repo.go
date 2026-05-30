package db

import (
	"errors"
	"fmt"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ErrTagOwnership is returned by ValidateTeamOwnership when one or more tag
// IDs belong to a different team (or do not exist).
var ErrTagOwnership = errors.New("tag belongs to another team")

// TagRepo is the persistence layer for Tag records.
type TagRepo struct {
	db *sqlx.DB
}

// NewTagRepo returns a TagRepo backed by db.
func NewTagRepo(db *sqlx.DB) *TagRepo {
	return &TagRepo{db: db}
}

// Create inserts a new Tag row.
func (r *TagRepo) Create(tag *models.Tag) error {
	_, err := r.db.NamedExec(`
		INSERT INTO tags (id, team_id, name, color, created_by, created_at)
		VALUES (:id, :team_id, :name, :color, :created_by, :created_at)
	`, tag)
	if err != nil {
		return fmt.Errorf("creating tag: %w", err)
	}
	return nil
}

// GetByID fetches a Tag by primary key. Returns sql.ErrNoRows (wrapped) when
// no row matches.
func (r *TagRepo) GetByID(id string) (*models.Tag, error) {
	var t models.Tag
	err := r.db.Get(&t, `SELECT * FROM tags WHERE id = ?`, id)
	if err != nil {
		return nil, fmt.Errorf("getting tag: %w", err)
	}
	return &t, nil
}

// ListByTeam returns all tags for the given team, ordered by name ascending.
func (r *TagRepo) ListByTeam(teamID string) ([]*models.Tag, error) {
	tags := make([]*models.Tag, 0)
	err := r.db.Select(&tags,
		`SELECT * FROM tags WHERE team_id = ? ORDER BY name ASC`,
		teamID,
	)
	if err != nil {
		return nil, fmt.Errorf("listing tags: %w", err)
	}
	return tags, nil
}

// Update writes name and color for an existing tag row.
func (r *TagRepo) Update(tag *models.Tag) error {
	_, err := r.db.NamedExec(`
		UPDATE tags SET name = :name, color = :color WHERE id = :id
	`, tag)
	if err != nil {
		return fmt.Errorf("updating tag: %w", err)
	}
	return nil
}

// Delete removes a tag row. Cascade deletes matching activity_tags rows.
func (r *TagRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM tags WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting tag: %w", err)
	}
	return nil
}

// ValidateTeamOwnership confirms that every ID in tagIDs belongs to teamID.
// Returns ErrTagOwnership if any ID is missing or owned by another team.
func (r *TagRepo) ValidateTeamOwnership(teamID string, tagIDs []string) error {
	if len(tagIDs) == 0 {
		return nil
	}
	query, args, err := sqlx.In(
		`SELECT COUNT(*) FROM tags WHERE id IN (?) AND team_id = ?`,
		tagIDs, teamID,
	)
	if err != nil {
		return fmt.Errorf("building ownership query: %w", err)
	}
	var count int
	if err := r.db.Get(&count, query, args...); err != nil {
		return fmt.Errorf("checking tag ownership: %w", err)
	}
	if count != len(tagIDs) {
		return ErrTagOwnership
	}
	return nil
}
