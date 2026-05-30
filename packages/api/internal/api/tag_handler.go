package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleListTags handles GET /teams/{id}/tags. Returns all tags for the team,
// ordered by name.
func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")

	if _, ok := s.requireTeamMember(w, r, teamID); !ok {
		return
	}

	tags, err := s.tags.ListByTeam(teamID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list tags")
		return
	}
	writeJSON(w, http.StatusOK, tags)
}

// tagNameMaxLen is the maximum byte length accepted for a tag name.
const tagNameMaxLen = 50

// handleCreateTag handles POST /teams/{id}/tags. Any team member may create a
// tag; they become the creator. Returns 409 when a tag with the same name
// already exists in the team.
func (s *Server) handleCreateTag(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, ok := s.requireTeamMember(w, r, teamID); !ok {
		return
	}

	var req struct {
		Name  string  `json:"name"`
		Color *string `json:"color,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}
	if len(req.Name) > tagNameMaxLen {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name must be 50 characters or fewer")
		return
	}

	tag := &models.Tag{
		ID:        newID(),
		TeamID:    teamID,
		Name:      req.Name,
		Color:     req.Color,
		CreatedBy: claims.UserID,
		CreatedAt: time.Now().UTC(),
	}
	if err := s.tags.Create(tag); err != nil {
		// SQLite unique constraint violation message contains "UNIQUE constraint failed"
		if isUniqueConstraintError(err) {
			writeError(w, http.StatusConflict, "TAG_NAME_EXISTS", "a tag with this name already exists in the team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create tag")
		return
	}
	writeJSON(w, http.StatusCreated, tag)
}

// handleUpdateTag handles PATCH /tags/{id}. Any team member may update the
// tag's name or color after confirming membership in the tag's team.
func (s *Server) handleUpdateTag(w http.ResponseWriter, r *http.Request) {
	tagID := r.PathValue("id")

	tag, err := s.tags.GetByID(tagID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "tag not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update tag")
		return
	}

	// Return 404 (not 403) for non-members so callers cannot probe tag existence.
	if !s.hasTeamAccess(r, tag.TeamID) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "tag not found")
		return
	}

	var req struct {
		Name  *string `json:"name,omitempty"`
		Color *string `json:"color,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Name != nil {
		if *req.Name == "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name must not be empty")
			return
		}
		if len(*req.Name) > tagNameMaxLen {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name must be 50 characters or fewer")
			return
		}
		tag.Name = *req.Name
	}
	if req.Color != nil {
		tag.Color = req.Color
	}

	if err := s.tags.Update(tag); err != nil {
		if isUniqueConstraintError(err) {
			writeError(w, http.StatusConflict, "TAG_NAME_EXISTS", "a tag with this name already exists in the team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update tag")
		return
	}
	writeJSON(w, http.StatusOK, tag)
}

// handleDeleteTag handles DELETE /tags/{id}. Any team member may delete a tag;
// the cascade removes all activity_tags rows referencing it.
func (s *Server) handleDeleteTag(w http.ResponseWriter, r *http.Request) {
	tagID := r.PathValue("id")

	tag, err := s.tags.GetByID(tagID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "tag not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete tag")
		return
	}

	// Return 404 (not 403) for non-members so callers cannot probe tag existence.
	if !s.hasTeamAccess(r, tag.TeamID) {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "tag not found")
		return
	}

	if err := s.tags.Delete(tagID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete tag")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
