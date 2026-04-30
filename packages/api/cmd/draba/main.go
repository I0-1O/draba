package main

import (
	"log"
	"net/http"
	"os"

	"github.com/I0-1O/draba/packages/api/internal/api"
	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
)

func main() {
	port := getenv("DRABA_PORT", "8080")
	dsn := getenv("DRABA_DB_DSN", "/data/draba.db")
	jwtSecret := getenv("DRABA_JWT_SECRET", "change-me-in-production")

	database, err := db.Open(dsn)
	if err != nil {
		log.Fatalf("opening database: %v", err)
	}

	if err := db.Migrate(database); err != nil {
		log.Fatalf("running migrations: %v", err)
	}

	users := db.NewUserRepo(database)
	invites := db.NewInviteRepo(database)
	tokens := auth.NewTokenService(jwtSecret)

	srv := api.NewServer(users, invites, tokens)

	log.Printf("draba listening on :%s", port)
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
