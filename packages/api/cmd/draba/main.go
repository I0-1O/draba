// Command draba is the API server entry point. It wires repositories,
// the auth token service, and tier configuration into the HTTP server,
// then listens for requests until the process is killed.
package main

import (
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"strings"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
	drabui "github.com/I0-1O/draba/packages/api/ui"
)

const banner = "\n" +
	"      _           _\n" +
	"     | |         | |\n" +
	"   __| |_ __ __ _| |__   __ _\n" +
	"  / _` | '__/ _` | '_ \\ / _` |\n" +
	" | (_| | | | (_| | |_) | (_| |\n" +
	"  \\__,_|_|  \\__,_|_.__/ \\__,_|\n" +
	"\n" +
	"  see who's doing what, when.\n\n"

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "reset-password":
			runResetPassword(os.Args[2:])
			return
		}
	}

	setupLogger()
	fmt.Print(banner)

	port := getenv("DRABA_PORT", "8080")
	dsn := getenv("DRABA_DB_DSN", "/data/draba.db")
	jwtSecret := os.Getenv("DRABA_JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("DRABA_JWT_SECRET must be set")
		os.Exit(1)
	}

	t, err := tier.Load()
	if err != nil {
		slog.Error("tier load failed", "err", err)
		os.Exit(1)
	}
	l := t.Limits()
	if l.MaxUsers == 0 {
		slog.Info("tier", "tier", t)
	} else {
		slog.Info("tier", "tier", t, "maxUsers", l.MaxUsers, "maxTeams", l.MaxTeams)
	}

	database, err := db.Open(dsn)
	if err != nil {
		slog.Error("db: open failed", "err", err)
		os.Exit(1)
	}
	slog.Info("db: opened", "dsn", dsn)

	if err := db.Migrate(database); err != nil {
		slog.Error("db: migrate failed", "err", err)
		os.Exit(1)
	}
	slog.Info("db: migrations applied")

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventRepo := db.NewEventRepo(database)
	timelineRepo := db.NewTimelineRepo(database)
	tokens := auth.NewTokenService(jwtSecret)

	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens, func(teamID, userID string) error {
		_, err := teams.GetMember(teamID, userID)
		return err
	})
	go hub.Run()
	slog.Info("ws: hub running")

	if mods := tier.Registered(); len(mods) > 0 {
		slog.Info("modules loaded", "count", len(mods))
	}

	srv := api.NewServer(users, invites, teams, eventRepo, timelineRepo, tokens, t, bus, hub)

	// Wire up the embedded React SPA when a production build is present.
	// In dev the static/ directory only has .gitkeep so this is a no-op.
	if sub, err := fs.Sub(drabui.FS, "static"); err == nil {
		if _, err := sub.Open("index.html"); err == nil {
			srv.WithUI(sub)
			slog.Info("ui: serving embedded SPA")
		}
	}

	slog.Info("listening", "port", port)
	if err := http.ListenAndServe(":"+port, srv.Routes()); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

// setupLogger initialises the global slog logger. Level is controlled by
// DRABA_LOG_LEVEL (debug | info | warn | error); default is info.
// All output goes to stdout so Docker captures it in `docker logs`.
func setupLogger() {
	level := slog.LevelInfo
	switch strings.ToLower(os.Getenv("DRABA_LOG_LEVEL")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level})))
}

// getenv returns the env var value or fallback when unset/empty.
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
