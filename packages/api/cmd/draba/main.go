package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
	"github.com/I0-1O/draba/packages/api/internal/tier"
)

const banner = `
 ⢀⣸ ⡀⣀ ⢀⣀ ⣇⡀ ⢀⣀
 ⠣⠼ ⠏  ⠣⠼ ⠧⠜ ⠣⠼
 team timelines for everyone.
`

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
	tokens := auth.NewTokenService(jwtSecret)

	if mods := tier.Registered(); len(mods) > 0 {
		log.Printf("modules: %d registered", len(mods))
	}

	srv := api.NewServer(users, invites, tokens, t)

	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, srv.Routes()); err != nil {
		log.Fatal(err)
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
