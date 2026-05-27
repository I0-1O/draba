package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ── Status templates ──────────────────────────────────────────────────────────

// handleListStatusTemplates handles GET /teams/{id}/status-templates.
// Any team member may list the team's status templates.
func (s *Server) handleListStatusTemplates(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list status templates")
		return
	}

	templates, err := s.statuses.ListTemplates(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list status templates")
		return
	}
	writeJSON(w, http.StatusOK, templates)
}

// handleCreateStatusTemplate handles POST /teams/{id}/status-templates.
// Team admins only.
func (s *Server) handleCreateStatusTemplate(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create status template")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	var req CreateStatusTemplateJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}

	// Position defaults to end of existing list.
	count, err := s.statuses.CountTemplates(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create status template")
		return
	}

	now := time.Now()
	t := &models.StatusTemplate{
		ID:        newID(),
		TeamID:    teamID,
		Name:      name,
		Position:  count,
		CreatedBy: claims.UserID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if req.Description != nil {
		t.Description = req.Description
	}
	if err := s.statuses.CreateTemplate(t); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create status template")
		return
	}
	t.Items = []models.StatusTemplateItem{}
	writeJSON(w, http.StatusCreated, t)
}

// handleUpdateStatusTemplate handles PATCH /status-templates/{id}.
// Team admins only.
func (s *Server) handleUpdateStatusTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	t, err := s.statuses.GetTemplate(templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "status template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update status template")
		return
	}

	member, err := s.teams.GetMember(t.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update status template")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	var req PatchStatusTemplateJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name cannot be empty")
			return
		}
		t.Name = name
	}
	if req.Description != nil {
		t.Description = req.Description
	}
	if req.Position != nil {
		t.Position = *req.Position
	}
	t.UpdatedAt = time.Now()

	if err := s.statuses.UpdateTemplate(t); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update status template")
		return
	}
	writeJSON(w, http.StatusOK, t)
}

// handleDeleteStatusTemplate handles DELETE /status-templates/{id}.
// Team admins only. Blocked if it is the last template on the team.
func (s *Server) handleDeleteStatusTemplate(w http.ResponseWriter, r *http.Request) {
	templateID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	t, err := s.statuses.GetTemplate(templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "status template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete status template")
		return
	}

	member, err := s.teams.GetMember(t.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete status template")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	count, err := s.statuses.CountTemplates(t.TeamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete status template")
		return
	}
	if count <= 1 {
		writeError(w, http.StatusConflict, "LAST_TEMPLATE", "cannot delete the last status template")
		return
	}

	if err := s.statuses.DeleteTemplate(templateID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete status template")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Template items ────────────────────────────────────────────────────────────

// handleCreateTemplateItem handles POST /status-templates/{id}/items.
// Team admins only.
func (s *Server) handleCreateTemplateItem(w http.ResponseWriter, r *http.Request) {
	templateID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	t, err := s.statuses.GetTemplate(templateID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "status template not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create template item")
		return
	}

	member, err := s.teams.GetMember(t.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create template item")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	var req CreateStatusTemplateItemJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}

	count, err := s.statuses.CountTemplateItems(templateID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create template item")
		return
	}

	color := "#8b949e"
	if req.Color != nil {
		color = *req.Color
	}

	item := &models.StatusTemplateItem{
		ID:         newID(),
		TemplateID: templateID,
		Name:       name,
		Color:      color,
		Icon:       req.Icon,
		Position:   count,
	}
	if req.IsClosed != nil {
		item.IsClosed = *req.IsClosed
	}

	if err := s.statuses.CreateTemplateItem(item); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create template item")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

// handleUpdateTemplateItem handles PATCH /status-template-items/{id}.
// Team admins only.
func (s *Server) handleUpdateTemplateItem(w http.ResponseWriter, r *http.Request) {
	itemID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	item, err := s.statuses.GetTemplateItem(itemID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "status template item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update template item")
		return
	}

	t, err := s.statuses.GetTemplate(item.TemplateID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update template item")
		return
	}

	member, err := s.teams.GetMember(t.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update template item")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	var req PatchStatusTemplateItemJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name cannot be empty")
			return
		}
		item.Name = name
	}
	if req.Color != nil {
		item.Color = *req.Color
	}
	if req.Icon != nil {
		item.Icon = req.Icon
	}
	if req.IsClosed != nil {
		item.IsClosed = *req.IsClosed
	}
	if req.Position != nil {
		item.Position = *req.Position
	}

	if err := s.statuses.UpdateTemplateItem(item); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update template item")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

// handleDeleteTemplateItem handles DELETE /status-template-items/{id}.
// Team admins only. Blocked if it is the last item in the template.
func (s *Server) handleDeleteTemplateItem(w http.ResponseWriter, r *http.Request) {
	itemID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	item, err := s.statuses.GetTemplateItem(itemID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "status template item not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete template item")
		return
	}

	t, err := s.statuses.GetTemplate(item.TemplateID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete template item")
		return
	}

	member, err := s.teams.GetMember(t.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete template item")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	count, err := s.statuses.CountTemplateItems(item.TemplateID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete template item")
		return
	}
	if count <= 1 {
		writeError(w, http.StatusConflict, "LAST_ITEM", "cannot delete the last item in a template")
		return
	}

	if err := s.statuses.DeleteTemplateItem(itemID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete template item")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Timeline statuses ─────────────────────────────────────────────────────────

// handleListTimelineStatuses handles GET /teams/{id}/timelines/{timelineId}/statuses.
// Any member with access to the timeline may list its statuses.
func (s *Server) handleListTimelineStatuses(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("timelineId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list statuses")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list statuses")
		return
	}

	if member.Role != "admin" {
		ok, err := s.timelines.HasAccess(timelineID, member.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list statuses")
			return
		}
		if !ok {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not on the access list for this timeline")
			return
		}
	}

	statuses, err := s.statuses.ListStatuses(timelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list statuses")
		return
	}
	writeJSON(w, http.StatusOK, statuses)
}
