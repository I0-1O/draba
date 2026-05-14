package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/events"
)

// testSetup returns a running hub, its event bus, and a test HTTP server that
// routes every request to hub.ServeWS (simulating the GET /ws endpoint).
func testSetup(t *testing.T) (*Hub, *events.Bus, *httptest.Server) {
	t.Helper()
	bus := events.NewBus()
	tokens := auth.NewTokenService("test-secret")
	hub := NewHub(bus, tokens)
	go hub.Run()
	srv := httptest.NewServer(http.HandlerFunc(hub.ServeWS))
	t.Cleanup(srv.Close)
	return hub, bus, srv
}

// issueToken issues an access token for testing.
func issueToken(t *testing.T, userID string) string {
	t.Helper()
	tok, err := auth.NewTokenService("test-secret").IssueAccessToken(userID, userID+"@example.com")
	require.NoError(t, err)
	return tok
}

// dial opens a WebSocket connection to srv with the given token query param.
func dial(t *testing.T, srv *httptest.Server, token string) *websocket.Conn {
	t.Helper()
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=" + token
	conn, _, err := websocket.DefaultDialer.Dial(u, nil)
	require.NoError(t, err)
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestHub_ServeWS_RejectsNoToken(t *testing.T) {
	_, _, srv := testSetup(t)
	u := "ws" + strings.TrimPrefix(srv.URL, "http")
	_, resp, err := websocket.DefaultDialer.Dial(u, nil)
	require.Error(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHub_ServeWS_RejectsInvalidToken(t *testing.T) {
	_, _, srv := testSetup(t)
	u := "ws" + strings.TrimPrefix(srv.URL, "http") + "?token=not.a.valid.token"
	_, resp, err := websocket.DefaultDialer.Dial(u, nil)
	require.Error(t, err)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHub_BroadcastToSubscribedTeam(t *testing.T) {
	_, bus, srv := testSetup(t)

	conn := dial(t, srv, issueToken(t, "u1"))

	// Subscribe to team1.
	sub, _ := json.Marshal(inboundMsg{Type: "subscribe", TeamID: "team1"})
	require.NoError(t, conn.WriteMessage(websocket.TextMessage, sub))

	// Give the hub time to register the subscription before publishing.
	time.Sleep(50 * time.Millisecond)

	bus.Publish(events.Message{Type: events.EventCreated, TeamID: "team1", Payload: map[string]string{"id": "evt1"}})

	conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	_, raw, err := conn.ReadMessage()
	require.NoError(t, err)

	var got OutboundMsg
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, string(events.EventCreated), got.Type)
}

func TestHub_NoLeakToOtherTeam(t *testing.T) {
	_, bus, srv := testSetup(t)

	connA := dial(t, srv, issueToken(t, "u1"))
	connB := dial(t, srv, issueToken(t, "u2"))

	subA, _ := json.Marshal(inboundMsg{Type: "subscribe", TeamID: "teamA"})
	subB, _ := json.Marshal(inboundMsg{Type: "subscribe", TeamID: "teamB"})
	require.NoError(t, connA.WriteMessage(websocket.TextMessage, subA))
	require.NoError(t, connB.WriteMessage(websocket.TextMessage, subB))

	// Give the hub time to register both subscriptions.
	time.Sleep(50 * time.Millisecond)

	// Publish only to teamA.
	bus.Publish(events.Message{Type: events.EventUpdated, TeamID: "teamA"})

	// connA (subscribed to teamA) should receive it.
	connA.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
	_, _, err := connA.ReadMessage()
	assert.NoError(t, err, "connA (teamA subscriber) should receive the event")

	// connB (subscribed to teamB) must not receive it.
	connB.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
	_, _, err = connB.ReadMessage()
	assert.Error(t, err, "connB (teamB subscriber) must not receive teamA's event")
}

func TestHub_TwoClientsOnSameTeamBothReceive(t *testing.T) {
	_, bus, srv := testSetup(t)

	conn1 := dial(t, srv, issueToken(t, "u1"))
	conn2 := dial(t, srv, issueToken(t, "u2"))

	sub, _ := json.Marshal(inboundMsg{Type: "subscribe", TeamID: "team1"})
	require.NoError(t, conn1.WriteMessage(websocket.TextMessage, sub))
	require.NoError(t, conn2.WriteMessage(websocket.TextMessage, sub))

	time.Sleep(50 * time.Millisecond)

	bus.Publish(events.Message{Type: events.EventDeleted, TeamID: "team1"})

	for _, conn := range []*websocket.Conn{conn1, conn2} {
		conn.SetReadDeadline(time.Now().Add(300 * time.Millisecond))
		_, raw, err := conn.ReadMessage()
		require.NoError(t, err)
		var got OutboundMsg
		require.NoError(t, json.Unmarshal(raw, &got))
		assert.Equal(t, string(events.EventDeleted), got.Type)
	}
}
