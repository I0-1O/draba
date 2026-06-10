package api

import (
	"database/sql"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/I0-1O/draba/packages/api/internal/ics"
	"github.com/I0-1O/draba/packages/api/internal/models"
)

// ── In-memory ICS feed cache ──────────────────────────────────────────────────
//
// Mirrors shareCache, but stores the rendered text/calendar payload. Calendar
// clients poll on their own cadence (minutes to hours), so the same short TTL
// keeps feeds near-live while absorbing aggressive pollers.

type icsCacheEntry struct {
	builtAt time.Time
	payload string
}

type icsFeedCache struct {
	mu      sync.RWMutex
	entries map[string]*icsCacheEntry
	ttl     time.Duration
}

func newICSFeedCache(ttl time.Duration) *icsFeedCache {
	return &icsFeedCache{entries: make(map[string]*icsCacheEntry), ttl: ttl}
}

func (c *icsFeedCache) get(token string) (string, bool) {
	c.mu.RLock()
	e, ok := c.entries[token]
	c.mu.RUnlock()
	if !ok || time.Since(e.builtAt) > c.ttl {
		return "", false
	}
	return e.payload, true
}

func (c *icsFeedCache) set(token, payload string) {
	c.mu.Lock()
	c.entries[token] = &icsCacheEntry{builtAt: time.Now(), payload: payload}
	c.mu.Unlock()
}

func (c *icsFeedCache) invalidate(token string) {
	c.mu.Lock()
	delete(c.entries, token)
	c.mu.Unlock()
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// serveICSFeed handles GET /shares/{token}.ics — the public, unauthenticated
// calendar feed. It is dispatched from handleGetShareProjection when the token
// path value carries the .ics suffix (Go 1.22 mux wildcards span the whole
// segment, so the suffix arrives inside {token}).
//
// The feed serves live data scoped server-side to the share's timeline — or,
// for member feeds, to one member's assigned activities. There is no password
// gate: calendar clients cannot unlock interactively, so the unguessable token
// is the secret and revocation is rotate-or-delete.
func (s *Server) serveICSFeed(w http.ResponseWriter, r *http.Request, token string) {
	share, err := s.shares.GetByToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to load share")
		return
	}
	// A view share is not a feed — 404 rather than leaking that the token
	// exists in another mode.
	if share.Kind != models.ShareKindICS {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
		return
	}
	if share.RevokedAt != nil {
		writeError(w, http.StatusGone, "GONE", "this share has been revoked")
		return
	}
	if share.ExpiresAt != nil && time.Now().After(*share.ExpiresAt) {
		writeError(w, http.StatusGone, "GONE", "this share has expired")
		return
	}

	body, ok := s.icsCache.get(token)
	if !ok {
		body, err = s.buildICSFeed(share)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to build calendar feed")
			return
		}
		s.icsCache.set(token, body)
	}

	go func() { _ = s.shares.RecordView(share.ID) }()
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Cache-Control", "max-age=60")
	_, _ = w.Write([]byte(body))
}

// buildICSFeed renders the iCalendar document for an ICS share. Scope is
// hard-locked server-side: the timeline comes from the share row, and member
// feeds drop every activity the member is not assigned to before
// serialization. The payload carries titles, dates, and descriptions only —
// never member emails, user IDs, or roles.
func (s *Server) buildICSFeed(share *models.Share) (string, error) {
	timeline, err := s.timelines.GetByID(share.TimelineID)
	if err != nil {
		return "", err
	}

	acts, err := s.activities.ListByTimeline(share.TimelineID, nil, nil, false)
	if err != nil {
		return "", err
	}

	name := timeline.Name
	if share.Scope != nil && *share.Scope == models.ShareScopeMember && share.MemberID != nil {
		filtered := acts[:0]
		for _, a := range acts {
			for _, id := range a.AssignedMemberIDs {
				if id == *share.MemberID {
					filtered = append(filtered, a)
					break
				}
			}
		}
		acts = filtered

		// The member's display name in the calendar title is the only
		// person-identifying field an ICS feed may carry.
		if m, err := s.teams.GetMemberByID(*share.MemberID); err == nil && m.DisplayName != "" {
			name = timeline.Name + " — " + m.DisplayName
		}
	}

	events := make([]ics.Event, 0, len(acts))
	for _, a := range acts {
		ev := ics.Event{
			UID:     a.ID + "@draba",
			Summary: a.Title,
			Start:   a.StartAt,
			End:     a.EndAt,
			Stamp:   a.UpdatedAt,
		}
		if a.Description != nil {
			ev.Description = *a.Description
		}
		events = append(events, ev)
	}
	return ics.Calendar(name, events), nil
}

// handleRegenerateShare handles POST /shares/{id}/regenerate. It rotates the
// share's token, immediately invalidating the old URL — the revocation story
// for ICS feeds, which cannot carry a password. It works for view shares too
// (rotating is strictly safer than nothing), and any member of the timeline's
// team may do it, consistent with PATCH/DELETE.
func (s *Server) handleRegenerateShare(w http.ResponseWriter, r *http.Request) {
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
	if _, ok := s.requireTeamMember(w, r, timeline.TeamID); !ok {
		return
	}

	oldToken := share.Token
	share.Token = newToken()
	if err := s.shares.RotateToken(share.ID, share.Token); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", "failed to regenerate share link")
		return
	}

	// Kill both caches for the dead token so it stops serving immediately.
	s.shareCache.invalidate(oldToken)
	s.icsCache.invalidate(oldToken)

	writeJSON(w, http.StatusOK, share)
}
