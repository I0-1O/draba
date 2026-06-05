package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/filters"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ── In-memory share cache ─────────────────────────────────────────────────────

type shareCacheEntry struct {
	builtAt time.Time
	payload models.ShareProjection
}

// shareCache is a lightweight TTL cache keyed by share token. It avoids a DB
// hit on every warm request. The TTL is read from DRABA_SHARE_CACHE_TTL at
// startup (default 60s); a PATCH or DELETE invalidates the entry immediately.
type shareCache struct {
	mu      sync.RWMutex
	entries map[string]*shareCacheEntry
	ttl     time.Duration
}

func newShareCache() *shareCache {
	ttl := 60 * time.Second
	if v := os.Getenv("DRABA_SHARE_CACHE_TTL"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			ttl = d
		}
	}
	return &shareCache{entries: make(map[string]*shareCacheEntry), ttl: ttl}
}

func (c *shareCache) get(token string) (*models.ShareProjection, bool) {
	c.mu.RLock()
	e, ok := c.entries[token]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if time.Since(e.builtAt) > c.ttl {
		return nil, false
	}
	p := e.payload
	return &p, true
}

func (c *shareCache) set(token string, p *models.ShareProjection) {
	c.mu.Lock()
	c.entries[token] = &shareCacheEntry{builtAt: time.Now(), payload: *p}
	c.mu.Unlock()
}

func (c *shareCache) invalidate(token string) {
	c.mu.Lock()
	delete(c.entries, token)
	c.mu.Unlock()
}

// ── viewConfig sub-types ──────────────────────────────────────────────────────

// viewConfigJSON is the shape stored in shares.view_config. The filter field
// is evaluated server-side by the Go filter engine; the other fields are
// forwarded to the client as-is so the public viewer can apply them.
type viewConfigJSON struct {
	Filter *filters.FilterDefinition `json:"filter,omitempty"`
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// handleGetShareProjection handles GET /shares/{token}. No authentication is
// required. It is the public data gateway: the scope is hard-locked to the
// single timeline referenced by the share row; no client-supplied selector can
// widen it.
func (s *Server) handleGetShareProjection(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")

	// ── 1. Resolve the share row ──────────────────────────────────────────────
	share, err := s.shares.GetByToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load share")
		return
	}

	// Phase 13.4 — revocation / expiry handled here (fields exist in schema now).
	if share.RevokedAt != nil {
		writeError(w, http.StatusGone, "GONE", "this share has been revoked")
		return
	}
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		writeError(w, http.StatusGone, "GONE", "this share has expired")
		return
	}

	// Phase 13.3 — password gate handled here.
	// NOTE: this check must stay above the cache read. PATCH invalidates the cache
	// entry immediately (see handleUpdateShare), so a newly-added password_hash is
	// never served from a stale cache. Moving the check below the cache read would
	// silently bypass the password gate for the TTL window.
	if share.PasswordHash != nil {
		writeError(w, http.StatusUnauthorized, "PASSWORD_REQUIRED", "password required")
		return
	}

	// ── 2. Serve from cache if warm ───────────────────────────────────────────
	if proj, ok := s.shareCache.get(token); ok {
		go func() { _ = s.shares.RecordView(share.ID) }()
		writeJSON(w, http.StatusOK, proj)
		return
	}

	// ── 3. Build projection (cache miss) ─────────────────────────────────────
	proj, err := s.buildShareProjection(share)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to build share projection")
		return
	}

	s.shareCache.set(token, proj)
	go func() { _ = s.shares.RecordView(share.ID) }()
	writeJSON(w, http.StatusOK, proj)
}

// buildShareProjection assembles the full ShareProjection for a share.
// The scope is hard-locked to share.TimelineID; the caller cannot supply a
// different timeline ID. Filter evaluation runs in Go before any data leaves
// the server.
func (s *Server) buildShareProjection(share *models.Share) (*models.ShareProjection, error) {
	// Get timeline — using the share's TimelineID, never a client-supplied value.
	timeline, err := s.timelines.GetByID(share.TimelineID)
	if err != nil {
		return nil, err
	}

	// Get all non-archived activities for this timeline.
	acts, err := s.activities.ListByTimeline(share.TimelineID, nil, nil, false)
	if err != nil {
		return nil, err
	}

	// Get statuses and tags for filter context + projection.
	statuses, err := s.statuses.ListStatuses(share.TimelineID)
	if err != nil {
		return nil, err
	}
	tags, err := s.tags.ListByTeam(timeline.TeamID)
	if err != nil {
		return nil, err
	}
	members, err := s.teams.ListMembers(timeline.TeamID)
	if err != nil {
		return nil, err
	}
	team, err := s.teams.GetByID(timeline.TeamID)
	if err != nil {
		return nil, err
	}

	// Parse the frozen filter from view_config and evaluate it server-side.
	var vc viewConfigJSON
	if share.ViewConfig != "" && share.ViewConfig != "{}" {
		_ = json.Unmarshal([]byte(share.ViewConfig), &vc)
	}

	var filteredActs []*models.Activity
	if vc.Filter != nil && len(vc.Filter.Conditions) > 0 {
		// Build filter context.
		statusesByTL := map[string][]models.Status{share.TimelineID: {}}
		for _, st := range statuses {
			statusesByTL[share.TimelineID] = append(statusesByTL[share.TimelineID], *st)
		}
		modelTags := make([]models.Tag, 0, len(tags))
		for _, t := range tags {
			modelTags = append(modelTags, *t)
		}
		ctx := &filters.FilterContext{
			StatusesByTimelineID: statusesByTL,
			Tags:                 modelTags,
		}
		for _, a := range acts {
			if filters.MatchesFilter(a, vc.Filter, ctx) {
				filteredActs = append(filteredActs, a)
			}
		}
	} else {
		filteredActs = acts
	}

	// Build referenced-entity sets (prune to what surviving activities reference).
	usedMemberIDs := make(map[string]bool)
	usedStatusIDs := make(map[string]bool)
	usedTagIDs := make(map[string]bool)
	for _, a := range filteredActs {
		for _, id := range a.AssignedMemberIDs {
			usedMemberIDs[id] = true
		}
		if a.StatusID != nil {
			usedStatusIDs[*a.StatusID] = true
		}
		for _, id := range a.TagIDs {
			usedTagIDs[id] = true
		}
	}

	// Build PublicActivity slice — notes omitted unless this is a list share
	// with notes enabled (Phase 13.2+ handles that nuance; for now always omit).
	pubActivities := make([]models.PublicActivity, 0, len(filteredActs))
	for _, a := range filteredActs {
		pub := models.PublicActivity{
			ID:                a.ID,
			Title:             a.Title,
			Description:       a.Description,
			Icon:              a.Icon,
			Color:             a.Color,
			StartAt:           a.StartAt,
			EndAt:             a.EndAt,
			AllDay:            a.AllDay,
			StatusID:          a.StatusID,
			ParentActivityID:  a.ParentActivityID,
			PercentComplete:   a.PercentComplete,
			AssignedMemberIDs: a.AssignedMemberIDs,
			TagIDs:            a.TagIDs,
		}
		if pub.AssignedMemberIDs == nil {
			pub.AssignedMemberIDs = []string{}
		}
		if pub.TagIDs == nil {
			pub.TagIDs = []string{}
		}
		pubActivities = append(pubActivities, pub)
	}

	// Build PublicMember slice — never email/role/userId.
	pubMembers := make([]models.PublicMember, 0)
	for _, m := range members {
		if !usedMemberIDs[m.ID] {
			continue
		}
		name := m.DisplayName
		if name == "" {
			// The register endpoint requires a non-empty displayName, so this
			// branch only fires for rows migrated from older data. Never fall
			// back to the email address — this response is public and
			// unauthenticated.
			name = "Team member"
		}
		pubMembers = append(pubMembers, models.PublicMember{
			ID:          m.ID,
			DisplayName: name,
			Color:       m.Color,
			Icon:        m.Icon,
		})
	}

	// Prune statuses to referenced ones.
	pubStatuses := make([]models.Status, 0)
	for _, st := range statuses {
		if usedStatusIDs[st.ID] {
			pubStatuses = append(pubStatuses, *st)
		}
	}

	// Prune tags to referenced ones.
	pubTags := make([]models.Tag, 0)
	for _, tg := range tags {
		if usedTagIDs[tg.ID] {
			pubTags = append(pubTags, *tg)
		}
	}

	// Build the public share — only the fields anonymous callers need.
	// Operational telemetry (view_count, last_viewed_at) and internal fields
	// (created_by, revoked_at) are excluded from the public response.
	pubShare := models.PublicShare{
		ID:         share.ID,
		TimelineID: share.TimelineID,
		Token:      share.Token,
		Name:       share.Name,
		ViewType:   share.ViewType,
		ViewConfig: share.ViewConfig,
		CreatedAt:  share.CreatedAt,
		ExpiresAt:  share.ExpiresAt,
	}
	proj := &models.ShareProjection{
		Share:    pubShare,
		TeamName: team.Name,
		Timeline: models.PublicTimeline{
			ID:        timeline.ID,
			Name:      timeline.Name,
			Color:     timeline.Color,
			Icon:      timeline.Icon,
			StartDate: timeline.StartDate,
			EndDate:   timeline.EndDate,
		},
		Members:    pubMembers,
		Statuses:   pubStatuses,
		Tags:       pubTags,
		Activities: pubActivities,
	}
	return proj, nil
}

// handleCreateShare handles POST /timelines/{id}/shares. The caller must be a
// member of the timeline's team. The share captures the current view config.
func (s *Server) handleCreateShare(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("id")

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}
	if timeline.ArchivedAt != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
		return
	}

	member, ok := s.requireTeamMember(w, r, timeline.TeamID)
	if !ok {
		return
	}

	var req createShareBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if req.ViewType == "" {
		req.ViewType = "gantt"
	}
	if req.ViewConfig == "" {
		req.ViewConfig = "{}"
	}

	now := time.Now().UTC()
	share := &models.Share{
		ID:         newID(),
		TimelineID: timelineID,
		Token:      newToken(),
		Name:       req.Name,
		ViewType:   req.ViewType,
		ViewConfig: req.ViewConfig,
		CreatedBy:  member.ID,
		CreatedAt:  now,
		ViewCount:  0,
	}

	if err := s.shares.Create(share); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create share")
		return
	}

	writeJSON(w, http.StatusCreated, share)
}

// handleListShares handles GET /teams/{id}/timelines/{timelineId}/shares.
// Only team members with access to the timeline may list its shares.
func (s *Server) handleListShares(w http.ResponseWriter, r *http.Request) {
	timelineID := r.PathValue("timelineId")

	timeline, err := s.timelines.GetByID(timelineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "timeline not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get timeline")
		return
	}

	if _, ok := s.requireTeamMember(w, r, timeline.TeamID); !ok {
		return
	}

	shares, err := s.shares.ListByTimeline(timelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to list shares")
		return
	}

	writeJSON(w, http.StatusOK, shares)
}

// handleUpdateShare handles PATCH /shares/{id}. Only the share creator or a
// team admin may update it.
func (s *Server) handleUpdateShare(w http.ResponseWriter, r *http.Request) {
	shareID := r.PathValue("id")

	share, err := s.shares.GetByID(shareID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get share")
		return
	}

	timeline, err := s.timelines.GetByID(share.TimelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get share")
		return
	}

	member, ok := s.requireTeamMember(w, r, timeline.TeamID)
	if !ok {
		return
	}
	if !s.canManageShare(member, share) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only the share creator or a team admin may update this share")
		return
	}

	var req patchShareBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}

	if req.Name != nil {
		share.Name = req.Name
	}
	if req.ViewType != nil {
		share.ViewType = *req.ViewType
	}
	if req.ViewConfig != nil {
		share.ViewConfig = *req.ViewConfig
	}

	if err := s.shares.Update(share); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update share")
		return
	}

	// Invalidate cache so the next public request picks up the new config.
	s.shareCache.invalidate(share.Token)

	writeJSON(w, http.StatusOK, share)
}

// handleDeleteShare handles DELETE /shares/{id}. Only the share creator or a
// team admin may delete it.
func (s *Server) handleDeleteShare(w http.ResponseWriter, r *http.Request) {
	shareID := r.PathValue("id")

	share, err := s.shares.GetByID(shareID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get share")
		return
	}

	timeline, err := s.timelines.GetByID(share.TimelineID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to get share")
		return
	}

	member, ok := s.requireTeamMember(w, r, timeline.TeamID)
	if !ok {
		return
	}
	if !s.canManageShare(member, share) {
		writeError(w, http.StatusForbidden, "FORBIDDEN", "only the share creator or a team admin may delete this share")
		return
	}

	if err := s.shares.Delete(shareID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete share")
		return
	}

	s.shareCache.invalidate(share.Token)
	w.WriteHeader(http.StatusNoContent)
}

// canManageShare reports whether a team member may update or delete a share.
// Team admins always pass; non-admins must be the share's creator.
func (s *Server) canManageShare(member *models.TeamMember, share *models.Share) bool {
	return member.Role == "admin" || member.ID == share.CreatedBy
}

// ── Request bodies ────────────────────────────────────────────────────────────

type createShareBody struct {
	Name       *string `json:"name,omitempty"`
	ViewType   string  `json:"viewType"`
	ViewConfig string  `json:"viewConfig"`
}

type patchShareBody struct {
	Name       *string `json:"name,omitempty"`
	ViewType   *string `json:"viewType,omitempty"`
	ViewConfig *string `json:"viewConfig,omitempty"`
}
