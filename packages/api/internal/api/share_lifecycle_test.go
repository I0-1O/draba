package api_test

// Phase 13.5 lifecycle-tail tests: archiving a timeline immediately kills its
// share links and ICS feeds (404, reversible via unarchive), and the timeline
// read responses carry the derived active-share count for the tile chip.

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/tier"
)

// TestShareArchive_ArchivedTimelineKillsSharesAndFeeds verifies the 13.5 exit
// criterion: archiving a timeline makes both the JSON gateway and the ICS feed
// return 404 immediately — even with warm caches, because the archived check
// runs before the cache read — and unarchiving resurrects both. 404, not 410:
// archive is reversible, and 410 would make calendar clients drop the
// subscription permanently.
func TestShareArchive_ArchivedTimelineKillsSharesAndFeeds(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	// One view share and one ICS feed on the same timeline.
	wV := httptest.NewRecorder()
	srv.ServeHTTP(wV, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wV.Code)
	var viewShare map[string]any
	require.NoError(t, json.NewDecoder(wV.Body).Decode(&viewShare))
	viewToken := viewShare["token"].(string)

	icsShare := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	icsToken := icsShare["token"].(string)

	gateway := func(shareToken string) int {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken, http.NoBody))
		return w.Code
	}
	feed := func(shareToken string) int {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/shares/"+shareToken+".ics", http.NoBody))
		return w.Code
	}

	// Warm both caches so the test proves archiving bypasses them.
	require.Equal(t, http.StatusOK, gateway(viewToken), "view share must serve before archive")
	require.Equal(t, http.StatusOK, feed(icsToken), "ICS feed must serve before archive")

	wA := httptest.NewRecorder()
	srv.ServeHTTP(wA, authReq(http.MethodPost, "/timelines/"+timelineID+"/archive", nil, token))
	require.Equal(t, http.StatusOK, wA.Code)

	assert.Equal(t, http.StatusNotFound, gateway(viewToken),
		"archived timeline's view share must 404 immediately, warm cache included")
	assert.Equal(t, http.StatusNotFound, feed(icsToken),
		"archived timeline's ICS feed must 404 immediately, warm cache included")

	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, authReq(http.MethodPost, "/timelines/"+timelineID+"/unarchive", nil, token))
	require.Equal(t, http.StatusOK, wU.Code)

	assert.Equal(t, http.StatusOK, gateway(viewToken), "unarchiving must resurrect the view share")
	assert.Equal(t, http.StatusOK, feed(icsToken), "unarchiving must resurrect the ICS feed")
}

// TestShareArchive_UnlockArchivedTimeline404 verifies the unlock endpoint
// mirrors the gateway: a password-protected share of an archived timeline
// 404s on unlock — before NOT_PROTECTED would fire — so archive state leaks
// nothing about a share's protection.
func TestShareArchive_UnlockArchivedTimeline404(t *testing.T) {
	srv, token, _, timelineID := shareTestSetup(t)

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}", "password": "hunter22",
	}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var share map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&share))
	shareToken := share["token"].(string)

	wA := httptest.NewRecorder()
	srv.ServeHTTP(wA, authReq(http.MethodPost, "/timelines/"+timelineID+"/archive", nil, token))
	require.Equal(t, http.StatusOK, wA.Code)

	wU := httptest.NewRecorder()
	srv.ServeHTTP(wU, httptest.NewRequest(http.MethodPost, "/shares/"+shareToken+"/unlock",
		jsonBody(t, map[string]string{"password": "hunter22"})))
	assert.Equal(t, http.StatusNotFound, wU.Code,
		"correct password must not unlock a share of an archived timeline")
}

// TestShareGateway_OrphanShare404 verifies that a share row outliving a
// hard-deleted timeline answers the same 404 as every other dead-share case
// on both public gateways — not a 500, which would be a state oracle. The
// shares FK is ON DELETE CASCADE so this state cannot arise through normal
// deletes; the test suspends FK enforcement to orphan the rows directly.
func TestShareGateway_OrphanShare404(t *testing.T) {
	srv, database := newTestServerWithDB(t, tier.Unlimited)

	token, _ := seedUser(t, srv, "alice@share.com", "password1", "Alice")

	w := httptest.NewRecorder()
	srv.ServeHTTP(w, authReq(http.MethodPost, "/teams", map[string]string{"name": "Share Team"}, token))
	require.Equal(t, http.StatusCreated, w.Code)
	var team map[string]any
	require.NoError(t, json.NewDecoder(w.Body).Decode(&team))
	teamID := team["id"].(string)

	w2 := httptest.NewRecorder()
	srv.ServeHTTP(w2, authReq(http.MethodPost, fmt.Sprintf("/teams/%s/timelines", teamID), map[string]any{
		"name": "Doomed Timeline", "startDate": "2026-01-01", "endDate": "2026-12-31",
	}, token))
	require.Equal(t, http.StatusCreated, w2.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(w2.Body).Decode(&tl))
	timelineID := tl["id"].(string)

	wV := httptest.NewRecorder()
	srv.ServeHTTP(wV, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wV.Code)
	var viewShare map[string]any
	require.NoError(t, json.NewDecoder(wV.Body).Decode(&viewShare))
	viewToken := viewShare["token"].(string)

	icsShare := createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})
	icsToken := icsShare["token"].(string)

	_, err := database.Exec(`PRAGMA foreign_keys = OFF`)
	require.NoError(t, err)
	_, err = database.Exec(`DELETE FROM timelines WHERE id = ?`, timelineID)
	require.NoError(t, err)
	_, err = database.Exec(`PRAGMA foreign_keys = ON`)
	require.NoError(t, err)

	// Guard against a vacuous pass: if the CASCADE fired anyway, the gateway
	// 404s from the share lookup and never reaches the orphan branch.
	var n int
	require.NoError(t, database.Get(&n, `SELECT COUNT(*) FROM shares WHERE timeline_id = ?`, timelineID))
	require.Equal(t, 2, n, "share rows must survive the timeline delete for this test to mean anything")

	wG := httptest.NewRecorder()
	srv.ServeHTTP(wG, httptest.NewRequest(http.MethodGet, "/shares/"+viewToken, http.NoBody))
	assert.Equal(t, http.StatusNotFound, wG.Code, "orphaned view share must 404, not 500")

	wF := httptest.NewRecorder()
	srv.ServeHTTP(wF, httptest.NewRequest(http.MethodGet, "/shares/"+icsToken+".ics", http.NoBody))
	assert.Equal(t, http.StatusNotFound, wF.Code, "orphaned ICS feed must 404, not 500")
}

// TestTimelineShareCount verifies the derived shareCount on timeline reads:
// it counts the timeline's active shares of both kinds and tracks deletes.
func TestTimelineShareCount(t *testing.T) {
	srv, token, teamID, timelineID := shareTestSetup(t)

	listCount := func() int {
		w := httptest.NewRecorder()
		srv.ServeHTTP(w, authReq(http.MethodGet, fmt.Sprintf("/teams/%s/timelines", teamID), nil, token))
		require.Equal(t, http.StatusOK, w.Code)
		var tls []map[string]any
		require.NoError(t, json.NewDecoder(w.Body).Decode(&tls))
		require.Len(t, tls, 1)
		return int(tls[0]["shareCount"].(float64))
	}

	assert.Equal(t, 0, listCount(), "no shares yet")

	wV := httptest.NewRecorder()
	srv.ServeHTTP(wV, authReq(http.MethodPost, fmt.Sprintf("/timelines/%s/shares", timelineID), map[string]any{
		"viewType": "gantt", "viewConfig": "{}",
	}, token))
	require.Equal(t, http.StatusCreated, wV.Code)
	var viewShare map[string]any
	require.NoError(t, json.NewDecoder(wV.Body).Decode(&viewShare))

	createICSShare(t, srv, token, timelineID, map[string]any{"scope": "timeline"})

	assert.Equal(t, 2, listCount(), "view share + ICS feed both count")

	wD := httptest.NewRecorder()
	srv.ServeHTTP(wD, authReq(http.MethodDelete, "/shares/"+viewShare["id"].(string), nil, token))
	require.Equal(t, http.StatusNoContent, wD.Code)

	assert.Equal(t, 1, listCount(), "deleting a share decrements the count")

	// The single-timeline read carries the count too.
	wG := httptest.NewRecorder()
	srv.ServeHTTP(wG, authReq(http.MethodGet, "/timelines/"+timelineID, nil, token))
	require.Equal(t, http.StatusOK, wG.Code)
	var tl map[string]any
	require.NoError(t, json.NewDecoder(wG.Body).Decode(&tl))
	assert.Equal(t, float64(1), tl["shareCount"])
}
