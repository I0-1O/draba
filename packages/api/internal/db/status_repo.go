// Package db — StatusRepo manages status templates, template items,
// and live timeline statuses.
package db

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// StatusRepo is the persistence layer for status templates and timeline statuses.
type StatusRepo struct {
	db *sqlx.DB
}

// NewStatusRepo returns a StatusRepo backed by db.
func NewStatusRepo(db *sqlx.DB) *StatusRepo {
	return &StatusRepo{db: db}
}

// ── Templates ─────────────────────────────────────────────────────────────────

// ListTemplates returns all status templates for a team, ordered by position,
// with their items populated.
func (r *StatusRepo) ListTemplates(teamID string) ([]*models.StatusTemplate, error) {
	var templates []*models.StatusTemplate
	if err := r.db.Select(&templates, `
		SELECT * FROM status_templates WHERE team_id = ? ORDER BY position, created_at
	`, teamID); err != nil {
		return nil, fmt.Errorf("listing status templates: %w", err)
	}

	// Populate items for each template in one query.
	if len(templates) == 0 {
		return templates, nil
	}
	ids := make([]string, len(templates))
	for i, t := range templates {
		ids[i] = t.ID
	}

	query, args, err := sqlx.In(`
		SELECT * FROM status_template_items WHERE template_id IN (?) ORDER BY position
	`, ids)
	if err != nil {
		return nil, fmt.Errorf("building status template items query: %w", err)
	}
	query = r.db.Rebind(query)
	var items []models.StatusTemplateItem
	if err := r.db.Select(&items, query, args...); err != nil {
		return nil, fmt.Errorf("listing status template items: %w", err)
	}

	byTemplate := make(map[string][]models.StatusTemplateItem)
	for _, item := range items {
		byTemplate[item.TemplateID] = append(byTemplate[item.TemplateID], item)
	}
	for _, t := range templates {
		t.Items = byTemplate[t.ID]
		if t.Items == nil {
			t.Items = []models.StatusTemplateItem{}
		}
	}
	return templates, nil
}

// GetTemplate returns a single status template by ID.
func (r *StatusRepo) GetTemplate(id string) (*models.StatusTemplate, error) {
	var t models.StatusTemplate
	if err := r.db.Get(&t, `SELECT * FROM status_templates WHERE id = ?`, id); err != nil {
		return nil, fmt.Errorf("getting status template: %w", err)
	}
	var items []models.StatusTemplateItem
	if err := r.db.Select(&items, `
		SELECT * FROM status_template_items WHERE template_id = ? ORDER BY position
	`, id); err != nil {
		return nil, fmt.Errorf("getting status template items: %w", err)
	}
	t.Items = items
	if t.Items == nil {
		t.Items = []models.StatusTemplateItem{}
	}
	return &t, nil
}

// CreateTemplate inserts a new status template.
func (r *StatusRepo) CreateTemplate(t *models.StatusTemplate) error {
	_, err := r.db.NamedExec(`
		INSERT INTO status_templates (id, team_id, name, description, position, created_by, created_at, updated_at)
		VALUES (:id, :team_id, :name, :description, :position, :created_by, :created_at, :updated_at)
	`, t)
	if err != nil {
		return fmt.Errorf("creating status template: %w", err)
	}
	return nil
}

// UpdateTemplate writes mutable template fields (name, description, position).
func (r *StatusRepo) UpdateTemplate(t *models.StatusTemplate) error {
	_, err := r.db.NamedExec(`
		UPDATE status_templates
		SET name = :name, description = :description, position = :position, updated_at = :updated_at
		WHERE id = :id
	`, t)
	if err != nil {
		return fmt.Errorf("updating status template: %w", err)
	}
	return nil
}

// CountTemplates returns the number of status templates for a team.
func (r *StatusRepo) CountTemplates(teamID string) (int, error) {
	var n int
	if err := r.db.Get(&n, `SELECT COUNT(*) FROM status_templates WHERE team_id = ?`, teamID); err != nil {
		return 0, fmt.Errorf("counting status templates: %w", err)
	}
	return n, nil
}

// DeleteTemplate deletes a status template by ID.
func (r *StatusRepo) DeleteTemplate(id string) error {
	_, err := r.db.Exec(`DELETE FROM status_templates WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting status template: %w", err)
	}
	return nil
}

// ── Template items ────────────────────────────────────────────────────────────

// GetTemplateItem returns a single template item by ID.
func (r *StatusRepo) GetTemplateItem(id string) (*models.StatusTemplateItem, error) {
	var item models.StatusTemplateItem
	if err := r.db.Get(&item, `SELECT * FROM status_template_items WHERE id = ?`, id); err != nil {
		return nil, fmt.Errorf("getting status template item: %w", err)
	}
	return &item, nil
}

// CreateTemplateItem inserts a new item into a template.
func (r *StatusRepo) CreateTemplateItem(item *models.StatusTemplateItem) error {
	_, err := r.db.NamedExec(`
		INSERT INTO status_template_items (id, template_id, name, color, icon, is_closed, position)
		VALUES (:id, :template_id, :name, :color, :icon, :is_closed, :position)
	`, item)
	if err != nil {
		return fmt.Errorf("creating status template item: %w", err)
	}
	return nil
}

// UpdateTemplateItem writes mutable item fields (name, color, icon, is_closed, position).
func (r *StatusRepo) UpdateTemplateItem(item *models.StatusTemplateItem) error {
	_, err := r.db.NamedExec(`
		UPDATE status_template_items
		SET name = :name, color = :color, icon = :icon, is_closed = :is_closed, position = :position
		WHERE id = :id
	`, item)
	if err != nil {
		return fmt.Errorf("updating status template item: %w", err)
	}
	return nil
}

// CountTemplateItems returns the number of items in a template.
func (r *StatusRepo) CountTemplateItems(templateID string) (int, error) {
	var n int
	if err := r.db.Get(&n, `SELECT COUNT(*) FROM status_template_items WHERE template_id = ?`, templateID); err != nil {
		return 0, fmt.Errorf("counting status template items: %w", err)
	}
	return n, nil
}

// DeleteTemplateItem deletes a single template item by ID.
func (r *StatusRepo) DeleteTemplateItem(id string) error {
	_, err := r.db.Exec(`DELETE FROM status_template_items WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("deleting status template item: %w", err)
	}
	return nil
}

// ── Seeding ───────────────────────────────────────────────────────────────────

// SeedDefaultTemplate creates the "Simple" template (Planned / In Progress / Done)
// for a newly created team. Done is marked is_closed = true.
func (r *StatusRepo) SeedDefaultTemplate(teamID, createdBy string) error {
	now := time.Now()
	templateID := newRepoID()
	t := &models.StatusTemplate{
		ID:        templateID,
		TeamID:    teamID,
		Name:      "Simple",
		Position:  0,
		CreatedBy: createdBy,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := r.CreateTemplate(t); err != nil {
		return err
	}

	type seed struct {
		name     string
		color    string
		isClosed bool
	}
	seeds := []seed{
		{"Planned", "#3B82F6", false},
		{"In Progress", "#F59E0B", false},
		{"Done", "#22C55E", true},
	}
	for i, s := range seeds {
		item := &models.StatusTemplateItem{
			ID:         newRepoID(),
			TemplateID: templateID,
			Name:       s.name,
			Color:      s.color,
			IsClosed:   s.isClosed,
			Position:   i,
		}
		if err := r.CreateTemplateItem(item); err != nil {
			return err
		}
	}
	return nil
}

// ── Timeline statuses ─────────────────────────────────────────────────────────

// ListStatuses returns all statuses for a timeline, ordered by position.
func (r *StatusRepo) ListStatuses(timelineID string) ([]*models.Status, error) {
	var statuses []*models.Status
	if err := r.db.Select(&statuses, `
		SELECT * FROM statuses WHERE timeline_id = ? ORDER BY position
	`, timelineID); err != nil {
		return nil, fmt.Errorf("listing statuses: %w", err)
	}
	if statuses == nil {
		statuses = []*models.Status{}
	}
	return statuses, nil
}

// GetStatus returns a single status by ID.
func (r *StatusRepo) GetStatus(id string) (*models.Status, error) {
	var s models.Status
	if err := r.db.Get(&s, `SELECT * FROM statuses WHERE id = ?`, id); err != nil {
		return nil, fmt.Errorf("getting status: %w", err)
	}
	return &s, nil
}

// CopyTemplateToTimeline copies a template's items into live statuses for a timeline.
// If no template is found for the team it is a silent no-op.
func (r *StatusRepo) CopyTemplateToTimeline(teamID, timelineID string) error {
	// Use the team's first template (by position, then created_at).
	var template models.StatusTemplate
	err := r.db.Get(&template, `
		SELECT * FROM status_templates WHERE team_id = ? ORDER BY position, created_at LIMIT 1
	`, teamID)
	if err != nil {
		// No template — not an error; leave the timeline with no statuses.
		return nil
	}

	var items []models.StatusTemplateItem
	if err := r.db.Select(&items, `
		SELECT * FROM status_template_items WHERE template_id = ? ORDER BY position
	`, template.ID); err != nil {
		return fmt.Errorf("loading template items for copy: %w", err)
	}

	now := time.Now()
	for _, item := range items {
		s := &models.Status{
			ID:         newRepoID(),
			TimelineID: timelineID,
			Name:       item.Name,
			Color:      item.Color,
			Icon:       item.Icon,
			IsClosed:   item.IsClosed,
			Position:   item.Position,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if _, err := r.db.NamedExec(`
			INSERT INTO statuses (id, timeline_id, name, color, icon, is_closed, position, created_at, updated_at)
			VALUES (:id, :timeline_id, :name, :color, :icon, :is_closed, :position, :created_at, :updated_at)
		`, s); err != nil {
			return fmt.Errorf("copying status to timeline: %w", err)
		}
	}
	return nil
}

// newRepoID generates a 32-character hex ID — same entropy as api.newID but
// usable within the db package without importing the api package.
func newRepoID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
