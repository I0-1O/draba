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

// handleCreateEvent handles POST /teams/{id}/events. The authenticated user
// must be a member of the team.
func (s *Server) handleCreateEvent(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create event")
		return
	}

	var req struct {
		Title           string    `json:"title"`
		Description     *string   `json:"description"`
		Icon            *string   `json:"icon"`
		Color           *string   `json:"color"`
		StartAt         time.Time `json:"startAt"`
		EndAt           time.Time `json:"endAt"`
		AllDay          bool      `json:"allDay"`
		StatusID        *string   `json:"statusId"`
		ParentEventID   *string   `json:"parentEventId"`
		PercentComplete *int      `json:"percentComplete"`
		Location        *string   `json:"location"`
		URL             *string   `json:"url"`
		Rrule           *string   `json:"rrule"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "title is required")
		return
	}
	if req.StartAt.IsZero() || req.EndAt.IsZero() {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "startAt and endAt are required")
		return
	}
	if req.EndAt.Before(req.StartAt) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endAt must not be before startAt")
		return
	}

	now := time.Now()
	event := &models.Event{
		ID:              newID(),
		TeamID:          teamID,
		Title:           req.Title,
		Description:     req.Description,
		Icon:            req.Icon,
		Color:           req.Color,
		StartAt:         req.StartAt,
		EndAt:           req.EndAt,
		AllDay:          req.AllDay,
		StatusID:        req.StatusID,
		ParentEventID:   req.ParentEventID,
		PercentComplete: req.PercentComplete,
		Location:        req.Location,
		URL:             req.URL,
		Rrule:           req.Rrule,
		CreatedBy:       claims.UserID,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.events.Create(event); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create event")
		return
	}

	s.bus.Publish(events.Message{Type: events.EventCreated, TeamID: event.TeamID, Payload: event})
	writeJSON(w, http.StatusCreated, event)
}

// handleListEvents handles GET /teams/{id}/events. Optional query params
// ?from=<RFC3339> and ?to=<RFC3339> bound the result by start_at.
func (s *Server) handleListEvents(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list events")
		return
	}

	var from, to *time.Time
	if v := r.URL.Query().Get("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "from must be RFC3339 (e.g. 2006-01-02T15:04:05Z)")
			return
		}
		from = &t
	}
	if v := r.URL.Query().Get("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "to must be RFC3339 (e.g. 2006-01-02T15:04:05Z)")
			return
		}
		to = &t
	}

	events, err := s.events.ListByTeam(teamID, from, to)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list events")
		return
	}

	writeJSON(w, http.StatusOK, events)
}

// handleUpdateEvent handles PATCH /events/{id}. Only fields present in the
// request body are applied; the caller must be a member of the event's team.
func (s *Server) handleUpdateEvent(w http.ResponseWriter, r *http.Request) {
	eventID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	event, err := s.events.GetByID(eventID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "event not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update event")
		return
	}

	if _, err := s.teams.GetMember(event.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update event")
		return
	}

	// Decode into a map so we can detect which fields the caller provided.
	var patch map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if v, ok := patch["title"]; ok {
		if err := json.Unmarshal(v, &event.Title); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid title")
			return
		}
	}
	if v, ok := patch["description"]; ok {
		if err := json.Unmarshal(v, &event.Description); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid description")
			return
		}
	}
	if v, ok := patch["icon"]; ok {
		if err := json.Unmarshal(v, &event.Icon); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid icon")
			return
		}
	}
	if v, ok := patch["color"]; ok {
		if err := json.Unmarshal(v, &event.Color); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid color")
			return
		}
	}
	if v, ok := patch["startAt"]; ok {
		if err := json.Unmarshal(v, &event.StartAt); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid startAt")
			return
		}
	}
	if v, ok := patch["endAt"]; ok {
		if err := json.Unmarshal(v, &event.EndAt); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid endAt")
			return
		}
	}
	if v, ok := patch["allDay"]; ok {
		if err := json.Unmarshal(v, &event.AllDay); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid allDay")
			return
		}
	}
	if v, ok := patch["statusId"]; ok {
		if err := json.Unmarshal(v, &event.StatusID); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid statusId")
			return
		}
	}
	if v, ok := patch["parentEventId"]; ok {
		if err := json.Unmarshal(v, &event.ParentEventID); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid parentEventId")
			return
		}
	}
	if v, ok := patch["percentComplete"]; ok {
		if err := json.Unmarshal(v, &event.PercentComplete); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid percentComplete")
			return
		}
	}
	if v, ok := patch["location"]; ok {
		if err := json.Unmarshal(v, &event.Location); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid location")
			return
		}
	}
	if v, ok := patch["url"]; ok {
		if err := json.Unmarshal(v, &event.URL); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid url")
			return
		}
	}
	if v, ok := patch["rrule"]; ok {
		if err := json.Unmarshal(v, &event.Rrule); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid rrule")
			return
		}
	}

	if event.Title == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "title must not be empty")
		return
	}
	if event.EndAt.Before(event.StartAt) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endAt must not be before startAt")
		return
	}

	event.UpdatedAt = time.Now()
	if err := s.events.Update(event); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update event")
		return
	}

	s.bus.Publish(events.Message{Type: events.EventUpdated, TeamID: event.TeamID, Payload: event})
	writeJSON(w, http.StatusOK, event)
}

// handleDeleteEvent handles DELETE /events/{id}. Any member of the event's
// team may delete it.
func (s *Server) handleDeleteEvent(w http.ResponseWriter, r *http.Request) {
	eventID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	event, err := s.events.GetByID(eventID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "event not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete event")
		return
	}

	if _, err := s.teams.GetMember(event.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete event")
		return
	}

	if err := s.events.Delete(eventID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete event")
		return
	}

	s.bus.Publish(events.Message{
		Type:    events.EventDeleted,
		TeamID:  event.TeamID,
		Payload: map[string]string{"id": eventID},
	})
	w.WriteHeader(http.StatusNoContent)
}
