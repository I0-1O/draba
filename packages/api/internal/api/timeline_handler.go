package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleCreateTimeline handles POST /teams/{id}/timelines. The authenticated
// user must be a member of the team.
func (s *Server) handleCreateTimeline(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	var req struct {
		Name       string `json:"name"`
		StartDate  string `json:"startDate"`
		EndDate    string `json:"endDate"`
		Visibility string `json:"visibility"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "name is required")
		return
	}
	if req.StartDate == "" || req.EndDate == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "startDate and endDate are required")
		return
	}
	const dateLayout = "2006-01-02"
	startDate, err := time.Parse(dateLayout, req.StartDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "startDate must be YYYY-MM-DD")
		return
	}
	endDate, err := time.Parse(dateLayout, req.EndDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endDate must be YYYY-MM-DD")
		return
	}
	if endDate.Before(startDate) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endDate must not be before startDate")
		return
	}
	if req.Visibility == "" {
		req.Visibility = "public"
	}
	if req.Visibility != "public" && req.Visibility != "restricted" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "visibility must be public or restricted")
		return
	}

	now := time.Now()
	timeline := &models.Timeline{
		ID:         newID(),
		TeamID:     teamID,
		Name:       req.Name,
		StartDate:  req.StartDate,
		EndDate:    req.EndDate,
		Visibility: req.Visibility,
		ShareToken: newID(),
		IcalToken:  newID(),
		CreatedBy:  claims.UserID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := s.timelines.Create(timeline); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	// Automatically grant the creator access to restricted timelines so they
	// are not immediately locked out of their own timeline.
	if timeline.Visibility == "restricted" {
		if err := s.timelines.GrantAccess(timeline.ID, claims.UserID); err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
			return
		}
	}

	s.bus.Publish(events.Message{Type: events.TimelineCreated, TeamID: timeline.TeamID, Payload: timeline})
	writeJSON(w, http.StatusCreated, timeline)
}

// handleGetTimeline handles GET /timelines/{id}. The authenticated user must
// be a member of the timeline's team; restricted timelines additionally
// require an entry in timeline_access.
func (s *Server) handleGetTimeline(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}

	// All authenticated requests require team membership.
	if _, err := s.teams.GetMember(timeline.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}

	// Restricted timelines require an explicit access entry.
	if timeline.Visibility == "restricted" {
		ok, err := s.timelines.HasAccess(timelineID, claims.UserID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
			return
		}
		if !ok {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not on the access list for this timeline")
			return
		}
	}

	writeJSON(w, http.StatusOK, timeline)
}

// handleGetTimelineByShareToken handles GET /timelines/share/{token}. No
// authentication is required; the token itself is the credential.
func (s *Server) handleGetTimelineByShareToken(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")

	timeline, err := s.timelines.GetByShareToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}

	writeJSON(w, http.StatusOK, timeline)
}
