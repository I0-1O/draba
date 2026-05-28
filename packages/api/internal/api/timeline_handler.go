package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// handleListTimelines handles GET /teams/{id}/timelines. Any team member may
// list the non-archived timelines for a team.
func (s *Server) handleListTimelines(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	if _, err := s.teams.GetMember(teamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list timelines")
		return
	}

	includeArchived := r.URL.Query().Get("archived") == "true"
	timelines, err := s.timelines.ListByTeam(teamID, includeArchived)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list timelines")
		return
	}

	writeJSON(w, http.StatusOK, timelines)
}

// handleCreateTimeline handles POST /teams/{id}/timelines. The authenticated
// user must be a member of the team. The creator is automatically granted
// timeline-admin access.
func (s *Server) handleCreateTimeline(w http.ResponseWriter, r *http.Request) {
	teamID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	member, err := s.teams.GetMember(teamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	var req createTimelineBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
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
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid startDate format")
		return
	}
	endDate, err := time.Parse(dateLayout, req.EndDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid endDate format")
		return
	}

	if endDate.Before(startDate) {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "endDate must not be before startDate")
		return
	}

	now := time.Now()
	timeline := &models.Timeline{
		ID:          newID(),
		TeamID:      teamID,
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
		Notes:       req.Notes,
		StartDate:   startDate.Format(dateLayout),
		EndDate:     endDate.Format(dateLayout),
		Color:       req.Color,
		Icon:        req.Icon,
		ShareToken:  newID(),
		IcalToken:   newID(),
		CreatedBy:   claims.UserID,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.timelines.Create(timeline); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	// Always grant the creator timeline-admin access so they can manage it.
	if err := s.timelines.GrantAccess(timeline.ID, member.ID, "admin"); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	// Copy the selected (or first) status template into live statuses for this timeline.
	if err := s.statuses.CopyTemplateToTimeline(teamID, timeline.ID, req.TemplateID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create timeline")
		return
	}

	s.bus.Publish(events.Message{Type: events.TimelineCreated, TeamID: timeline.TeamID, Payload: timeline})
	writeJSON(w, http.StatusCreated, timeline)
}

// handleGetTimeline handles GET /timelines/{id}. The authenticated user must
// be a member of the timeline's team. Team admins may access any timeline;
// other members require an entry in timeline_access.
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
	// Hide archived timelines from the standard read path unless ?archived=true.
	if timeline.ArchivedAt != nil && r.URL.Query().Get("archived") != "true" {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}

	// Team admins can access all timelines; members need an explicit grant.
	if member.Role != "admin" {
		ok, err := s.timelines.HasAccess(timelineID, member.ID)
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

// handleArchiveTimeline handles POST /timelines/{id}/archive. Only team
// admins or timeline admins may archive.
func (s *Server) handleArchiveTimeline(w http.ResponseWriter, r *http.Request) {
	s.setTimelineArchive(w, r, true)
}

// handleUnarchiveTimeline handles POST /timelines/{id}/unarchive.
func (s *Server) handleUnarchiveTimeline(w http.ResponseWriter, r *http.Request) {
	s.setTimelineArchive(w, r, false)
}

// setTimelineArchive is the shared archive/unarchive implementation. Access
// is admin-only: the caller must be a team admin, or hold timeline_access
// with role='admin' for this timeline.
func (s *Server) setTimelineArchive(w http.ResponseWriter, r *http.Request, archive bool) {
	timelineID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}
	// Team admins always pass. Per-timeline admin grants are not consulted
	// here — granular timeline-admin checks are tracked for Phase 10.3.
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	var at *time.Time
	if archive {
		now := time.Now().UTC()
		at = &now
	}
	if err := s.timelines.SetArchived(timelineID, at); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}
	timeline.ArchivedAt = at
	timeline.UpdatedAt = time.Now().UTC()

	s.bus.Publish(events.Message{Type: events.TimelineUpdated, TeamID: timeline.TeamID, Payload: timeline})
	writeJSON(w, http.StatusOK, timeline)
}

// handleUpdateTimeline handles PATCH /timelines/{id}. Only a team admin or a
// member with timeline_access role='admin' may rename or change dates.
func (s *Server) handleUpdateTimeline(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}

	if !s.canAdminTimeline(member, timelineID) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "timeline admin role required")
		return
	}

	var req PatchTimelineJSONBody
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
		timeline.Name = name
	}
	if req.StartDate != nil {
		timeline.StartDate = *req.StartDate
	}
	if req.EndDate != nil {
		timeline.EndDate = *req.EndDate
	}
	if req.Color != nil {
		timeline.Color = req.Color
	}
	if req.Icon != nil {
		timeline.Icon = req.Icon
	}
	if req.Description != nil {
		timeline.Description = req.Description
	}
	if req.Notes != nil {
		timeline.Notes = req.Notes
	}
	timeline.UpdatedAt = time.Now().UTC()

	if err := s.timelines.Update(timeline); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update timeline")
		return
	}

	s.bus.Publish(events.Message{Type: events.TimelineUpdated, TeamID: timeline.TeamID, Payload: timeline})
	writeJSON(w, http.StatusOK, timeline)
}

// handleDeleteTimeline handles DELETE /timelines/{id}. Hard-deletes the
// timeline; only a team admin may delete. Cascades to statuses and
// timeline_access via foreign key.
func (s *Server) handleDeleteTimeline(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("id")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete timeline")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete timeline")
		return
	}
	if member.Role != "admin" {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "team admin role required")
		return
	}

	if err := s.timelines.Delete(timelineID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete timeline")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleListTimelineAccess handles GET /teams/{id}/timelines/{timelineId}/access.
// Team members may list the access grants for any timeline they can view.
func (s *Server) handleListTimelineAccess(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("timelineId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list access")
		return
	}

	if _, err := s.teams.GetMember(timeline.TeamID, claims.UserID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list access")
		return
	}

	entries, err := s.timelines.ListAccess(timelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list access")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// handleGrantTimelineAccess handles PUT /teams/{id}/timelines/{timelineId}/access/{memberId}.
// Only team admins or timeline admins may manage the access list.
func (s *Server) handleGrantTimelineAccess(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("timelineId")
	targetMemberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to grant access")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to grant access")
		return
	}
	if !s.canAdminTimeline(member, timelineID) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "timeline admin role required")
		return
	}

	// Verify the target member belongs to the same team.
	if _, err := s.teams.GetMemberByID(targetMemberID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "team member not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to grant access")
		return
	}

	var req GrantTimelineAccessJSONBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.Role != "admin" && req.Role != "member" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "role must be admin or member")
		return
	}

	if err := s.timelines.GrantAccess(timelineID, targetMemberID, req.Role); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to grant access")
		return
	}

	entries, err := s.timelines.ListAccess(timelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to grant access")
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

// handleRevokeTimelineAccess handles DELETE /teams/{id}/timelines/{timelineId}/access/{memberId}.
// Only team admins or timeline admins may revoke access.
func (s *Server) handleRevokeTimelineAccess(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("timelineId")
	targetMemberID := r.PathValue("memberId")
	claims := claimsFromContext(r.Context())

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke access")
		return
	}

	member, err := s.teams.GetMember(timeline.TeamID, claims.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "not a member of this team")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke access")
		return
	}
	if !s.canAdminTimeline(member, timelineID) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "timeline admin role required")
		return
	}

	if err := s.timelines.RevokeAccess(timelineID, targetMemberID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to revoke access")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// canAdminTimeline reports whether a team member may perform admin operations
// on a timeline. Team admins always pass; members must hold timeline_access
// with role='admin'.
func (s *Server) canAdminTimeline(member *models.TeamMember, timelineID string) bool {
	if member.Role == "admin" {
		return true
	}
	role, err := s.timelines.GetAccessRole(timelineID, member.ID)
	if err != nil {
		return false
	}
	return role == "admin"
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
