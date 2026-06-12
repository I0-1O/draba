package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/filters"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// unlockMaxAttempts caps password-unlock attempts per client IP per hour. The
// limit is per-share-independent (keyed on IP only) so cycling tokens cannot
// multiply an attacker's budget.
const unlockMaxAttempts = 10

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
//
// columns carries the List view's column visibility snapshot — it drives the
// "notes" projection nuance below (and lets the public viewer render exactly
// the columns the share creator chose).
type viewConfigJSON struct {
	Filter  *filters.FilterDefinition `json:"filter,omitempty"`
	Columns []shareColumnConfig       `json:"columns,omitempty"`
}

type shareColumnConfig struct {
	ID      string `json:"id"`
	Visible bool   `json:"visible"`
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// handleGetShareProjection handles GET /shares/{token}. No authentication is
// required. It is the public data gateway: the scope is hard-locked to the
// single timeline referenced by the share row; no client-supplied selector can
// widen it.
func (s *Server) handleGetShareProjection(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")

	// GET /shares/{token}.ics — Go 1.22 mux wildcards span the whole path
	// segment, so the ICS feed's .ics suffix arrives inside {token}; dispatch
	// it to the calendar-feed handler (Phase 13.4).
	if strings.HasSuffix(token, ".ics") {
		s.serveICSFeed(w, r, strings.TrimSuffix(token, ".ics"))
		return
	}

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

	// An ICS feed is only reachable through the .ics endpoint. Serving it as a
	// JSON projection would expose the whole timeline for member-scoped feeds
	// (the projection has no member filter), so the kinds never cross over.
	if share.Kind != models.ShareKindView {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
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

	// Archived timeline → its shares stop serving (Phase 13.5). Checked on
	// every request — before the cache read — so archiving takes effect
	// immediately regardless of a warm projection cache.
	if !s.shareTimelineLive(w, share) {
		return
	}

	// Password gate (Phase 13.2). A locked share serves no data without a valid
	// view token — obtained by exchanging the password at POST /shares/{token}/unlock.
	// NOTE: this check must stay above the cache read. PATCH invalidates the cache
	// entry immediately (see handleUpdateShare), so a newly-added password_hash is
	// never served from a stale cache. Moving the check below the cache read would
	// silently bypass the password gate for the TTL window. The 401 body carries no
	// projection data — only the passwordRequired signal the viewer needs.
	if share.PasswordHash != nil {
		vt := bearerToken(r)
		if vt == "" || s.tokens.ValidateShareViewToken(vt, share.ID) != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]bool{"passwordRequired": true})
			return
		}
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

// shareTimelineLive loads the share's timeline and reports whether it is
// servable on the public surface, writing the error response when it is not.
// An archived timeline answers 404, not 410: archiving is reversible —
// unarchiving must resurrect existing links — and 410 tells calendar clients
// to drop a subscription permanently. 404 also matches handleCreateShare's
// archived-timeline response without leaking archive state.
func (s *Server) shareTimelineLive(w http.ResponseWriter, share *models.Share) bool {
	timeline, err := s.timelines.GetByID(share.TimelineID)
	if errors.Is(err, sql.ErrNoRows) {
		// A share row outliving a hard-deleted timeline answers the same 404 as
		// every other dead-share case — a 500 here would be a state oracle on
		// the public surface.
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
		return false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load share")
		return false
	}
	if timeline.ArchivedAt != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
		return false
	}
	return true
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

	// notes is included only for List shares whose creator left the Notes
	// column visible — the only projection nuance beyond scope-locking and
	// field-pruning (Phase 13.3 exit criteria).
	notesEnabled := false
	if share.ViewType == "list" {
		for _, c := range vc.Columns {
			if c.ID == "notes" && c.Visible {
				notesEnabled = true
				break
			}
		}
	}

	// Build PublicActivity slice.
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
		if notesEnabled {
			pub.Notes = a.Notes
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

	// Prune statuses to referenced ones — except for Kanban shares, where
	// every status is a column regardless of whether it currently holds any
	// activities (mirrors the in-app board, which always renders one column
	// per timeline status). Pruning there would silently drop empty columns
	// that anonymous viewers would otherwise see, e.g. an empty "Deferred"
	// column that's still meaningful to the team.
	pubStatuses := make([]models.Status, 0)
	for _, st := range statuses {
		if share.ViewType == "kanban" || usedStatusIDs[st.ID] {
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
	if req.Kind == "" {
		req.Kind = models.ShareKindView
	}
	if req.Kind != models.ShareKindView && req.Kind != models.ShareKindICS {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "kind must be 'view' or 'ics'")
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
		ID:          newID(),
		TimelineID:  timelineID,
		Token:       newToken(),
		Kind:        req.Kind,
		Name:        req.Name,
		Description: req.Description,
		ViewType:    req.ViewType,
		ViewConfig:  req.ViewConfig,
		CreatedAt:   now,
		ViewCount:   0,
	}
	// A superadmin managing a team they're not in arrives as a synthetic
	// member with an empty ID (see requireTeamMember); created_by stays NULL
	// for them rather than violating the team_members FK.
	if member.ID != "" {
		share.CreatedBy = &member.ID
	}

	if req.Kind == models.ShareKindICS {
		// An ICS feed has no view semantics and no password — the token is the
		// secret (calendar clients cannot unlock interactively). Scope is the
		// only configuration: the whole timeline, or one member's assignments.
		if req.Password != nil && strings.TrimSpace(*req.Password) != "" {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "ICS feeds cannot be password protected")
			return
		}
		if req.Scope != models.ShareScopeTimeline && req.Scope != models.ShareScopeMember {
			writeError(w, http.StatusBadRequest, "BAD_REQUEST", "scope must be 'timeline' or 'member' for ICS shares")
			return
		}
		share.Scope = &req.Scope
		share.ViewType = "calendar"
		share.ViewConfig = "{}"
		if req.Scope == models.ShareScopeMember {
			if req.MemberID == nil || *req.MemberID == "" {
				writeError(w, http.StatusBadRequest, "BAD_REQUEST", "memberId is required for member-scoped ICS shares")
				return
			}
			// The member must belong to this timeline's team — a feed must not
			// be creatable for an arbitrary member ID from another team.
			feedMember, err := s.teams.GetMemberByID(*req.MemberID)
			if err != nil || feedMember.TeamID != timeline.TeamID {
				writeError(w, http.StatusBadRequest, "BAD_REQUEST", "memberId does not belong to this timeline's team")
				return
			}
			share.MemberID = req.MemberID
		}
	}

	// Optional password protection (view shares only). An empty/whitespace
	// string means "no password" — the field stays NULL and the share is open.
	if req.Kind == models.ShareKindView && req.Password != nil && strings.TrimSpace(*req.Password) != "" {
		hash, err := auth.HashPassword(*req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to secure share")
			return
		}
		share.PasswordHash = &hash
	}

	if err := s.shares.Create(share); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to create share")
		return
	}

	// Surface the derived flag in the create response (the repo sets it on reads).
	share.Protected = share.PasswordHash != nil
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

// handleUpdateShare handles PATCH /shares/{id}. Any member of the timeline's
// team may update it (shares are read-only projections — no creator/admin gate).
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

	// Any member of the timeline's team may manage its shares. A share is a
	// read-only projection that can never mutate app data, so there is no
	// creator/admin gate (Phase 13.2 re-sequencing decision).
	if _, ok := s.requireTeamMember(w, r, timeline.TeamID); !ok {
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
	if req.Description != nil {
		share.Description = req.Description
	}
	if req.ViewType != nil {
		share.ViewType = *req.ViewType
	}
	if req.ViewConfig != nil {
		share.ViewConfig = *req.ViewConfig
	}
	// Password: nil leaves it unchanged; an empty string clears protection; a
	// non-empty string sets/replaces it. ICS feeds can never carry one —
	// calendar clients have no interactive unlock.
	if req.Password != nil && share.Kind == models.ShareKindICS && strings.TrimSpace(*req.Password) != "" {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "ICS feeds cannot be password protected")
		return
	}
	if req.Password != nil {
		if strings.TrimSpace(*req.Password) == "" {
			share.PasswordHash = nil
		} else {
			hash, err := auth.HashPassword(*req.Password)
			if err != nil {
				writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to secure share")
				return
			}
			share.PasswordHash = &hash
		}
	}

	if err := s.shares.Update(share); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to update share")
		return
	}

	// Invalidate caches so the next public request picks up the new config.
	s.shareCache.invalidate(share.Token)
	s.icsCache.invalidate(share.Token)

	// Refresh the derived flag — the password may have just been set/cleared.
	share.Protected = share.PasswordHash != nil
	writeJSON(w, http.StatusOK, share)
}

// handleDeleteShare handles DELETE /shares/{id}. Any member of the timeline's
// team may delete it (see handleUpdateShare).
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

	// Any member of the timeline's team may delete its shares — no creator/admin
	// gate (see handleUpdateShare).
	if _, ok := s.requireTeamMember(w, r, timeline.TeamID); !ok {
		return
	}

	if err := s.shares.Delete(shareID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to delete share")
		return
	}

	s.shareCache.invalidate(share.Token)
	s.icsCache.invalidate(share.Token)
	w.WriteHeader(http.StatusNoContent)
}

// handleUnlockShare handles POST /shares/{token}/unlock. It is public (no auth
// middleware): an anonymous viewer exchanges the share password for a
// short-lived view token, which they then present on GET /shares/{token}.
// Attempts are rate-limited per client IP to blunt brute-force guessing.
func (s *Server) handleUnlockShare(w http.ResponseWriter, r *http.Request) {
	if !s.unlockLimiter.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "RATE_LIMITED", "too many unlock attempts; try again later")
		return
	}

	token := r.PathValue("token")

	share, err := s.shares.GetByToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load share")
		return
	}

	// Mirror the GET gateway's revocation/expiry checks so a dead share cannot
	// be unlocked.
	if share.RevokedAt != nil {
		writeError(w, http.StatusGone, "GONE", "this share has been revoked")
		return
	}
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		writeError(w, http.StatusGone, "GONE", "this share has expired")
		return
	}
	// ICS feeds are never password protected; mirror the projection gateway's
	// 404 rather than confirming the token exists in another mode.
	if share.Kind != models.ShareKindView {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
		return
	}
	// Mirror the GET gateway's archived-timeline 404 (Phase 13.5) — a dead
	// share must not be unlockable, and the check precedes NOT_PROTECTED so an
	// archived timeline reveals nothing about its shares' protection state.
	if !s.shareTimelineLive(w, share) {
		return
	}
	if share.PasswordHash == nil {
		writeError(w, http.StatusBadRequest, "NOT_PROTECTED", "this share is not password protected")
		return
	}

	var req unlockShareBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid request body")
		return
	}
	if auth.CheckPassword(*share.PasswordHash, req.Password) != nil {
		writeError(w, http.StatusUnauthorized, "INVALID_PASSWORD", "incorrect password")
		return
	}

	viewToken, err := s.tokens.IssueShareViewToken(share.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to issue view token")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": viewToken})
}

// bearerToken extracts a Bearer credential from the Authorization header, or
// returns "" when absent or malformed.
func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(header, "Bearer ")
}

// ── Request bodies ────────────────────────────────────────────────────────────

type createShareBody struct {
	Kind        string  `json:"kind,omitempty"`
	Scope       string  `json:"scope,omitempty"`
	MemberID    *string `json:"memberId,omitempty"`
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	ViewType    string  `json:"viewType"`
	ViewConfig  string  `json:"viewConfig"`
	Password    *string `json:"password,omitempty"`
}

type patchShareBody struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	ViewType    *string `json:"viewType,omitempty"`
	ViewConfig  *string `json:"viewConfig,omitempty"`
	Password    *string `json:"password,omitempty"`
}

type unlockShareBody struct {
	Password string `json:"password"`
}
