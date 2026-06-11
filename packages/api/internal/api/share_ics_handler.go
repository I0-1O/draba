package api

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
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
	// no-store: the token is the secret and rotate/delete is the only kill
	// switch for a feed, so a revoked URL must not keep serving from browser
	// or proxy caches. Server-side load is already absorbed by icsCache.
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write([]byte(body))
}

// buildICSFeed renders the iCalendar document for an ICS share. Scope is
// hard-locked server-side: the timeline comes from the share row, and member
// feeds drop every activity the member is not assigned to before
// serialization.
//
// Each VEVENT projects the activity's display fields: status (+ percent
// complete), assignee display names, and tag names go into DESCRIPTION (and
// tags into CATEGORIES); whole-timeline feeds also append assignee names to
// SUMMARY so the month grid shows who owns what. Member display names are the
// only person-identifying field a feed may carry — never emails, user IDs, or
// roles.
func (s *Server) buildICSFeed(share *models.Share) (string, error) {
	timeline, err := s.timelines.GetByID(share.TimelineID)
	if err != nil {
		return "", err
	}

	acts, err := s.activities.ListByTimeline(share.TimelineID, nil, nil, false)
	if err != nil {
		return "", err
	}

	// Display-name / tag / status lookups for the event field projection.
	statuses, err := s.statuses.ListStatuses(share.TimelineID)
	if err != nil {
		return "", err
	}
	statusName := make(map[string]string, len(statuses))
	for _, st := range statuses {
		statusName[st.ID] = st.Name
	}
	members, err := s.teams.ListMembers(timeline.TeamID)
	if err != nil {
		return "", err
	}
	memberName := make(map[string]string, len(members))
	for _, m := range members {
		if m.DisplayName != "" {
			memberName[m.ID] = m.DisplayName
		}
	}
	tags, err := s.tags.ListByTeam(timeline.TeamID)
	if err != nil {
		return "", err
	}
	tagName := make(map[string]string, len(tags))
	for _, tg := range tags {
		tagName[tg.ID] = tg.Name
	}

	memberScoped := share.Scope != nil && *share.Scope == models.ShareScopeMember && share.MemberID != nil

	name := timeline.Name
	if memberScoped {
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

		if n, ok := memberName[*share.MemberID]; ok {
			name = timeline.Name + " — " + n
		}
	}

	events := make([]ics.Event, 0, len(acts))
	for _, a := range acts {
		assignees := make([]string, 0, len(a.AssignedMemberIDs))
		for _, id := range a.AssignedMemberIDs {
			if n, ok := memberName[id]; ok {
				assignees = append(assignees, n)
			}
		}
		tagNames := make([]string, 0, len(a.TagIDs))
		for _, id := range a.TagIDs {
			if n, ok := tagName[id]; ok {
				tagNames = append(tagNames, n)
			}
		}

		summary := a.Title
		// A member feed is one person's calendar — repeating their name on
		// every event is noise. The whole-timeline feed is the team overview,
		// where who-owns-what belongs in the month grid.
		if !memberScoped && len(assignees) > 0 {
			summary += " — " + strings.Join(assignees, ", ")
		}

		// Structured field lines first, then a blank line, then the
		// free-text activity description.
		meta := make([]string, 0, 3)
		if a.StatusID != nil {
			if n, ok := statusName[*a.StatusID]; ok {
				line := "Status: " + n
				if a.PercentComplete != nil {
					line += fmt.Sprintf(" (%d%%)", *a.PercentComplete)
				}
				meta = append(meta, line)
			}
		} else if a.PercentComplete != nil {
			meta = append(meta, fmt.Sprintf("Progress: %d%%", *a.PercentComplete))
		}
		if len(assignees) > 0 {
			meta = append(meta, "Assigned: "+strings.Join(assignees, ", "))
		}
		if len(tagNames) > 0 {
			meta = append(meta, "Tags: "+strings.Join(tagNames, ", "))
		}
		desc := strings.Join(meta, "\n")
		if a.Description != nil && *a.Description != "" {
			if desc != "" {
				desc += "\n\n"
			}
			desc += *a.Description
		}

		events = append(events, ics.Event{
			UID:         a.ID + "@draba",
			Summary:     summary,
			Description: desc,
			Categories:  tagNames,
			Start:       a.StartAt,
			End:         a.EndAt,
			Stamp:       a.UpdatedAt,
		})
	}
	return ics.Calendar(name, events), nil
}

// handleGetShareICSNamed handles GET /shares/{token}/{file}. The file segment
// must end in .ics but is otherwise cosmetic: most calendar clients
// (Thunderbird included) default the new calendar's name from the URL's
// filename, so the modal links carry a readable slug (e.g. .../sales-kick-off.ics).
// The token alone is authoritative.
func (s *Server) handleGetShareICSNamed(w http.ResponseWriter, r *http.Request) {
	if !strings.HasSuffix(r.PathValue("file"), ".ics") {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "share not found")
		return
	}
	s.serveICSFeed(w, r, r.PathValue("token"))
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
