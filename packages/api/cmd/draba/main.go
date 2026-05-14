// Command draba is the API server entry point. It wires repositories,
// the auth token service, and tier configuration into the HTTP server,
// then listens for requests until the process is killed.
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/events"
	"github.com/I0-1O/draba/packages/api/internal/tier"
	"github.com/I0-1O/draba/packages/api/internal/ws"
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
	fmt.Print(banner)

	port := getenv("DRABA_PORT", "8080")
	dsn := getenv("DRABA_DB_DSN", "/data/draba.db")
	jwtSecret := os.Getenv("DRABA_JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("DRABA_JWT_SECRET must be set")
	}

	t, err := tier.Load()
	if err != nil {
		log.Fatalf("tier: %v", err)
	}
	l := t.Limits()
	if l.MaxUsers == 0 {
		log.Printf("tier: %s", t)
	} else {
		log.Printf("tier: %s (max users: %d, max teams: %d)", t, l.MaxUsers, l.MaxTeams)
	}

	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("db: open: %v", err)
	}
	log.Printf("db: opened %s", dsn)

	if err := db.Migrate(database); err != nil {
		log.Fatalf("db: migrate: %v", err)
	}
	log.Printf("db: migrations applied")

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	teams := db.NewTeamRepo(database)
	eventRepo := db.NewEventRepo(database)
	tokens := auth.NewTokenService(jwtSecret)

	bus := events.NewBus()
	hub := ws.NewHub(bus, tokens)
	go hub.Run()
	log.Printf("ws: hub running")

	if mods := tier.Registered(); len(mods) > 0 {
		log.Printf("modules: %d registered", len(mods))
	}

	srv := api.NewServer(users, invites, teams, eventRepo, tokens, t, bus, hub)

	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, srv.Routes()); err != nil {
		log.Fatal(err)
	}
}

// getenv returns the env var value or fallback when unset/empty.
func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
