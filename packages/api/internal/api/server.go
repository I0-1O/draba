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
	"github.com/I0-1O/draba/packages/api/internal/tier"
)

// Server holds shared dependencies for all HTTP handlers.
type Server struct {
	users   *db.UserRepo
	invites *db.InviteRepo
	teams   *db.TeamRepo
	events  *db.EventRepo
	tokens  *auth.TokenService
	tier    tier.Tier
}

// NewServer constructs a Server with its required dependencies. It does not
// touch the network; call Routes to obtain the http.Handler to serve.
func NewServer(users *db.UserRepo, invites *db.InviteRepo, teams *db.TeamRepo, events *db.EventRepo, tokens *auth.TokenService, t tier.Tier) *Server {
	return &Server{
		users:   users,
		invites: invites,
		teams:   teams,
		events:  events,
		tokens:  tokens,
		tier:    t,
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

	return mux
}

// chain applies a single middleware to a handler function.
func chain(h http.HandlerFunc, m func(http.Handler) http.Handler) http.HandlerFunc {
	return m(h).ServeHTTP
}
