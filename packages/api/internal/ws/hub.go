// Package ws implements the WebSocket hub and per-client read/write pumps.
// The hub maintains a team-scoped subscription map and fans out domain event
// messages to all clients that have subscribed to a given team.
package ws

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/events"
)

const (
	heartbeatInterval = 30 * time.Second
	// writeTimeout is the maximum time allowed to write a single message.
	writeTimeout = 10 * time.Second
	// readTimeout is the read deadline reset after every pong. It is long
	// enough for a client to respond to at least two ping cycles.
	readTimeout     = 70 * time.Second
	maxMessageBytes = 512
)

// MemberChecker reports whether userID belongs to teamID.
// A non-nil error (including sql.ErrNoRows) means the user is not a member.
// It is satisfied in production by wrapping (*db.TeamRepo).GetMember.
type MemberChecker func(teamID, userID string) error

var upgrader = websocket.Upgrader{
	// Origin check is intentionally permissive; auth is enforced via JWT.
	CheckOrigin:     func(_ *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// inboundMsg is a client-to-server WebSocket message.
type inboundMsg struct {
	Type   string `json:"type"`
	TeamID string `json:"teamId,omitempty"`
}

// OutboundMsg is a server-to-client WebSocket message. It is exported so
// tests can assert on the wire shape without duplicating the type.
type OutboundMsg struct {
	Type    string `json:"type"`
	Payload any    `json:"payload,omitempty"`
}

// client represents one active WebSocket connection.
type client struct {
	conn    *websocket.Conn
	send    chan OutboundMsg
	mu      sync.RWMutex
	teamIDs map[string]struct{}
	userID  string
}

// Hub manages all connected WebSocket clients and routes broadcast messages
// to team-subscribed clients. Call Run in a goroutine before serving requests.
type Hub struct {
	tokens  *auth.TokenService
	members MemberChecker
	bus     *events.Bus

	mu    sync.RWMutex
	teams map[string]map[*client]struct{} // teamID → set of clients
}

// NewHub returns a Hub wired to the given event bus, auth token service, and
// member checker. The checker gates subscribe messages: only users who are
// members of a team may subscribe to its real-time feed.
func NewHub(bus *events.Bus, tokens *auth.TokenService, members MemberChecker) *Hub {
	return &Hub{
		tokens:  tokens,
		members: members,
		bus:     bus,
		teams:   make(map[string]map[*client]struct{}),
	}
}

// Run subscribes to the event bus and broadcasts domain events to the
// appropriate team subscribers. It blocks until the bus subscription channel
// is closed; call it in its own goroutine.
func (h *Hub) Run() {
	ch := h.bus.Subscribe()
	defer h.bus.Unsubscribe(ch)
	for msg := range ch {
		h.broadcast(msg.TeamID, OutboundMsg{Type: string(msg.Type), Payload: msg.Payload})
	}
}

// ServeWS upgrades an HTTP request to a WebSocket connection, validates the
// JWT from the ?token query parameter, and drives the client read/write pumps.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	tokenStr := r.URL.Query().Get("token")
	if tokenStr == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return
	}
	claims, err := h.tokens.Validate(tokenStr, "access")
	if err != nil {
		http.Error(w, "invalid or expired token", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		// Upgrade wrote the HTTP error; log and return.
		slog.Error("ws: upgrade failed", "err", err)
		return
	}

	c := &client{
		conn:    conn,
		send:    make(chan OutboundMsg, 64),
		teamIDs: make(map[string]struct{}),
		userID:  claims.UserID,
	}
	slog.Debug("ws: client connected", "userID", claims.UserID)

	go c.writePump(h)
	c.readPump(h)
}

// subscribe adds c to the subscription set for teamID.
func (h *Hub) subscribe(c *client, teamID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.teams[teamID] == nil {
		h.teams[teamID] = make(map[*client]struct{})
	}
	h.teams[teamID][c] = struct{}{}

	c.mu.Lock()
	c.teamIDs[teamID] = struct{}{}
	c.mu.Unlock()
}

// unsubscribeAll removes c from every team subscription set it belongs to
// and logs the disconnect.
func (h *Hub) unsubscribeAll(c *client) {
	slog.Debug("ws: client disconnected", "userID", c.userID)
	h.mu.Lock()
	defer h.mu.Unlock()
	c.mu.RLock()
	defer c.mu.RUnlock()
	for teamID := range c.teamIDs {
		delete(h.teams[teamID], c)
		if len(h.teams[teamID]) == 0 {
			delete(h.teams, teamID)
		}
	}
}

// broadcast delivers msg to every client subscribed to teamID. Sends are
// non-blocking; slow clients are skipped rather than stalling the broadcast.
func (h *Hub) broadcast(teamID string, msg OutboundMsg) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.teams[teamID] {
		select {
		case c.send <- msg:
		default:
			// Slow client — drop rather than block.
		}
	}
}

// readPump reads inbound messages from the WebSocket connection and handles
// the subscribe and pong message types. It returns when the connection closes,
// triggering deferred cleanup.
func (c *client) readPump(h *Hub) {
	defer func() {
		h.unsubscribeAll(c)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageBytes)
	_ = c.conn.SetReadDeadline(time.Now().Add(readTimeout))

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Warn("ws: unexpected close", "userID", c.userID, "err", err)
			}
			return
		}

		var msg inboundMsg
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "subscribe":
			if msg.TeamID != "" {
				if err := h.members(msg.TeamID, c.userID); err != nil {
					slog.Debug("ws: subscribe denied", "userID", c.userID, "teamID", msg.TeamID)
					select {
					case c.send <- OutboundMsg{Type: "error", Payload: "not a member of team " + msg.TeamID}:
					default:
					}
				} else {
					slog.Debug("ws: subscribed", "userID", c.userID, "teamID", msg.TeamID)
					h.subscribe(c, msg.TeamID)
				}
			}
		case "pong":
			// Extend the read deadline when the client acknowledges a ping.
			_ = c.conn.SetReadDeadline(time.Now().Add(readTimeout))
		}
	}
}

// writePump sends outgoing messages and heartbeat pings to the WebSocket
// connection. It returns when the send channel is closed or a write fails,
// triggering a connection close that causes readPump to return too.
func (c *client) writePump(_ *Hub) {
	ticker := time.NewTicker(heartbeatInterval)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteJSON(msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := c.conn.WriteJSON(OutboundMsg{Type: "ping"}); err != nil {
				return
			}
		}
	}
}
