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

// handleCreateActivity handles POST /teams/{id}/timelines/{timelineId}/activities.
// The authenticated user must be a member of the team.
func (s *Server) handleCreateActivity(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	timelineID := r.PathValue("timelineId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create activity")
		return
	}
	if timeline.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create activity")
		return
	}

	var req CreateActivityJSONBody
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

	allDay := false
	if req.AllDay != nil {
		allDay = *req.AllDay
	}

	now := time.Now()
	activity := &models.Activity{
		ID:               newID(),
		TimelineID:       timelineID,
		Title:            req.Title,
		Description:      req.Description,
		Icon:             req.Icon,
		Color:            req.Color,
		StartAt:          req.StartAt,
		EndAt:            req.EndAt,
		AllDay:           allDay,
		StatusID:         req.StatusId,
		ParentActivityID: req.ParentActivityId,
		PercentComplete:  req.PercentComplete,
		Location:         req.Location,
		URL:              req.Url,
		Rrule:            req.Rrule,
		CreatedBy:        claims.UserID,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.activities.Create(activity); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create activity")
		return
	}

	if req.AssignedMemberIds != nil {
		if err := s.activities.SetAssignments(activity.ID, *req.AssignedMemberIds); err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to set activity assignments")
			return
		}
		activity.AssignedMemberIDs = *req.AssignedMemberIds
	} else {
		activity.AssignedMemberIDs = []string{}
	}

	s.bus.Publish(events.Message{Type: events.ActivityCreated, TeamID: timeline.TeamID, Payload: activity})
	writeJSON(w, http.StatusCreated, activity)
}

// handleListActivities handles GET /teams/{id}/timelines/{timelineId}/activities.
// Optional query params ?from=<RFC3339> and ?to=<RFC3339> bound the result by start_at.
func (s *Server) handleListActivities(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	timelineID := r.PathValue("timelineId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list activities")
		return
	}
	if timeline.TeamID != teamID {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list activities")
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

	includeArchived := r.URL.Query().Get("archived") == "true"
	acts, err := s.activities.ListByTimeline(timelineID, from, to, includeArchived)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list activities")
		return
	}

	writeJSON(w, http.StatusOK, acts)
}

// handleUpdateActivity handles PATCH /activities/{id}. Only fields present in
// the request body are applied; the caller must be a member of the activity's team.
func (s *Server) handleUpdateActivity(w http.ResponseWriter, r *http.Request) {
	activityID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	activity, err := s.activities.GetByID(activityID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "activity not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update activity")
		return
	}

	timeline, err := s.timelines.GetByID(activity.TimelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update activity")
		return
	}

	if _, err := s.teams.GetMember(timeline.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update activity")
		return
	}

	// Decode into a map so we can detect which fields the caller provided.
	var patch map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if v, ok := patch["title"]; ok {
		if err := json.Unmarshal(v, &activity.Title); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid title")
			return
		}
	}
	if v, ok := patch["description"]; ok {
		if err := json.Unmarshal(v, &activity.Description); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid description")
			return
		}
	}
	if v, ok := patch["icon"]; ok {
		if err := json.Unmarshal(v, &activity.Icon); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid icon")
			return
		}
	}
	if v, ok := patch["color"]; ok {
		if err := json.Unmarshal(v, &activity.Color); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid color")
			return
		}
	}
	if v, ok := patch["startAt"]; ok {
		if err := json.Unmarshal(v, &activity.StartAt); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid startAt")
			return
		}
	}
	if v, ok := patch["endAt"]; ok {
		if err := json.Unmarshal(v, &activity.EndAt); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid endAt")
			return
		}
	}
	if v, ok := patch["allDay"]; ok {
		if err := json.Unmarshal(v, &activity.AllDay); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid allDay")
			return
		}
	}
	if v, ok := patch["statusId"]; ok {
		if err := json.Unmarshal(v, &activity.StatusID); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid statusId")
			return
		}
	}
	if v, ok := patch["parentActivityId"]; ok {
		if err := json.Unmarshal(v, &activity.ParentActivityID); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid parentActivityId")
			return
		}
	}
	if v, ok := patch["percentComplete"]; ok {
		if err := json.Unmarshal(v, &activity.PercentComplete); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid percentComplete")
			return
		}
	}
	if v, ok := patch["location"]; ok {
		if err := json.Unmarshal(v, &activity.Location); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid location")
			return
		}
	}
	if v, ok := patch["url"]; ok {
		if err := json.Unmarshal(v, &activity.URL); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid url")
			return
		}
	}
	if v, ok := patch["rrule"]; ok {
		if err := json.Unmarshal(v, &activity.Rrule); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid rrule")
			return
		}
	}

	var newAssignees *[]string
	if v, ok := patch["assignedMemberIds"]; ok {
		var ids []string
		if err := json.Unmarshal(v, &ids); err != nil {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid assignedMemberIds")
			return
		}
		newAssignees = &ids
	}

	if activity.Title == "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "title must not be empty")
		return
	}
	if activity.EndAt.Before(activity.StartAt) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endAt must not be before startAt")
		return
	}

	activity.UpdatedAt = time.Now()
	if err := s.activities.Update(activity); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update activity")
		return
	}

	if newAssignees != nil {
		if err := s.activities.SetAssignments(activity.ID, *newAssignees); err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to set activity assignments")
			return
		}
		activity.AssignedMemberIDs = *newAssignees
	} else {
		// Populate current assignments so the response always includes them.
		existing, err := s.activities.GetAssignments(activity.ID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get activity assignments")
			return
		}
		activity.AssignedMemberIDs = existing
	}

	s.bus.Publish(events.Message{Type: events.ActivityUpdated, TeamID: timeline.TeamID, Payload: activity})
	writeJSON(w, http.StatusOK, activity)
}

// handleArchiveActivity handles POST /activities/{id}/archive. Any team member
// may archive an activity; the row is soft-deleted (archived_at set) so it is
// hidden from list responses by default but can be restored.
func (s *Server) handleArchiveActivity(w http.ResponseWriter, r *http.Request) {
	s.setActivityArchive(w, r, true)
}

// handleUnarchiveActivity handles POST /activities/{id}/unarchive.
func (s *Server) handleUnarchiveActivity(w http.ResponseWriter, r *http.Request) {
	s.setActivityArchive(w, r, false)
}

// setActivityArchive is the shared implementation for the archive/unarchive
// endpoints. When archive is true, archived_at is set to now; otherwise it
// is cleared.
func (s *Server) setActivityArchive(w http.ResponseWriter, r *http.Request, archive bool) {
	activityID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	activity, err := s.activities.GetByID(activityID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "activity not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive activity")
		return
	}

	timeline, err := s.timelines.GetByID(activity.TimelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive activity")
		return
	}

	if _, err := s.teams.GetMember(timeline.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive activity")
		return
	}

	var at *time.Time
	if archive {
		now := time.Now().UTC()
		at = &now
	}
	if err := s.activities.SetArchived(activityID, at); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to archive activity")
		return
	}
	activity.ArchivedAt = at
	activity.UpdatedAt = time.Now().UTC()

	// Re-populate assignments for a stable response shape.
	if ids, err := s.activities.GetAssignments(activity.ID); err == nil {
		activity.AssignedMemberIDs = ids
	} else {
		activity.AssignedMemberIDs = []string{}
	}

	s.bus.Publish(events.Message{Type: events.ActivityUpdated, TeamID: timeline.TeamID, Payload: activity})
	writeJSON(w, http.StatusOK, activity)
}

// handleDeleteActivity handles DELETE /activities/{id}. Any member of the
// activity's team may delete it.
func (s *Server) handleDeleteActivity(w http.ResponseWriter, r *http.Request) {
	activityID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	activity, err := s.activities.GetByID(activityID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "activity not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete activity")
		return
	}

	timeline, err := s.timelines.GetByID(activity.TimelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete activity")
		return
	}

	if _, err := s.teams.GetMember(timeline.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete activity")
		return
	}

	if err := s.activities.Delete(activityID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete activity")
		return
	}

	s.bus.Publish(events.Message{
		Type:    events.ActivityDeleted,
		TeamID:  timeline.TeamID,
		Payload: map[string]string{"id": activityID},
	})
	w.WriteHeader(http.StatusNoContent)
}
