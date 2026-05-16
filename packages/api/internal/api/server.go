// Package api hosts the HTTP handlers, routing, and middleware for the
// draba REST API. Handlers are intentionally thin: they decode requests,
// delegate to repositories and services, and write responses. Business
// logic belongs in the domain packages, not here.
package api

import (
	"fmt"
	"net/http"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/models"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
)

// TimelineStore is the persistence interface required by timeline handlers.
// The concrete implementation is *db.TimelineRepo; tests may substitute a fake.
type TimelineStore interface {
	Create(t *models.Timeline) error
	GetByID(id string) (*models.Timeline, error)
	GetByShareToken(token string) (*models.Timeline, error)
	HasAccess(timelineID, userID string) (bool, error)
	GrantAccess(timelineID, userID string) error
}

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	users     *db.UserRepo
	invites   *db.InviteRepo
	teams     *db.TeamRepo
	events    *db.EventRepo
	timelines TimelineStore
	tokens    *auth.TokenService
	tier      tier.Tier
	bus       *events.Bus
	hub       *ws.Hub
}

// NewServer constructs a Server with its required dependencies. It does not
// touch the network; call Routes to obtain the http.Handler to serve.
func NewServer(users *db.UserRepo, invites *db.InviteRepo, teams *db.TeamRepo, eventsRepo *db.EventRepo, timelinesRepo TimelineStore, tokens *auth.TokenService, t tier.Tier, bus *events.Bus, hub *ws.Hub) *Server {
	return &Server{
		users:     users,
		invites:   invites,
		teams:     teams,
		events:    eventsRepo,
		timelines: timelinesRepo,
		tokens:    tokens,
		tier:      t,
		bus:       bus,
		hub:       hub,
	}
}

// Routes returns the fully-wired HTTP handler for the API, including all
// core routes plus any routes added by registered tier modules.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /auth/register", s.handleRegister)
	mux.HandleFunc("POST /auth/login", s.handleLogin)
	mux.HandleFunc("POST /auth/refresh", s.handleRefresh)
	mux.HandleFunc("GET /auth/me", chain(s.handleMe, s.authMiddleware))

	mux.HandleFunc("POST /teams", chain(s.handleCreateTeam, s.authMiddleware))
	mux.HandleFunc("GET /teams/{id}", chain(s.handleGetTeam, s.authMiddleware))
	mux.HandleFunc("POST /teams/{id}/invites", chain(s.handleCreateInvite, s.authMiddleware))
	mux.HandleFunc("GET /teams/{id}/members", chain(s.handleListMembers, s.authMiddleware))
	mux.HandleFunc("POST /teams/{id}/events", chain(s.handleCreateEvent, s.authMiddleware))
	mux.HandleFunc("GET /teams/{id}/events", chain(s.handleListEvents, s.authMiddleware))
	mux.HandleFunc("PATCH /events/{id}", chain(s.handleUpdateEvent, s.authMiddleware))
	mux.HandleFunc("DELETE /events/{id}", chain(s.handleDeleteEvent, s.authMiddleware))

	mux.HandleFunc("POST /teams/{id}/timelines", chain(s.handleCreateTimeline, s.authMiddleware))
	// GET /timelines/share/{token} must be registered before GET /timelines/{id} so
	// the more-specific literal "share" segment takes precedence.
	mux.HandleFunc("GET /timelines/share/{token}", s.handleGetTimelineByShareToken)
	mux.HandleFunc("GET /timelines/{id}", chain(s.handleGetTimeline, s.authMiddleware))

	// GET /ws is intentionally outside authMiddleware — ServeWS validates the
	// JWT itself before upgrading, because WebSocket clients can't set headers.
	mux.HandleFunc("GET /ws", s.hub.ServeWS)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	ctx := &tier.ModuleContext{Mux: mux, Tier: s.tier}
	for _, m := range tier.Registered() {
		if err := m.Register(ctx); err != nil {
			// Module registration is a startup invariant — a failure here is a programming error.
			panic(fmt.Sprintf("tier module %q failed to register: %v", m.Name(), err))
		}
	}

	return requestLogger(mux)
}

// chain applies a single middleware to a handler function.
func chain(h http.HandlerFunc, m func(http.Handler) http.Handler) http.HandlerFunc {
	return m(h).ServeHTTP
}
