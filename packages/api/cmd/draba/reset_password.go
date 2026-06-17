package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/I0-1O/draba/packages/api/internal/auth"
	"github.com/I0-1O/draba/packages/api/internal/db"
)

// runResetPassword is the handler for the reset-password subcommand.
// It opens the database, hashes the supplied password, and updates the user record.
func runResetPassword(args []string) {
	fs := flag.NewFlagSet("reset-password", flag.ExitOnError)
	email := fs.String("email", "", "email address of the user (required)")
	password := fs.String("password", "", "new password — minimum 8 characters (required)")
	fs.Usage = func() {
		fmt.Fprintln(os.Stderr, "Usage: draba reset-password --email <email> --password <password>")
		fs.PrintDefaults()
	}
	_ = fs.Parse(args)

	*email = strings.ToLower(strings.TrimSpace(*email))
	if *email == "" || *password == "" {
		fs.Usage()
		os.Exit(1)
	}
	if len(*password) < 8 {
		fmt.Fprintln(os.Stderr, "error: password must be at least 8 characters")
		os.Exit(1)
	}

	dsn := getenv("DRABA_DB_DSN", "/data/draba.db")
	database, err := db.Open(dsn)
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: open db: %v\n", err)
		os.Exit(1)
	}

	hash, err := auth.HashPassword(*password)
	if err != nil {
		_ = database.Close()
		fmt.Fprintf(os.Stderr, "error: hash password: %v\n", err)
		os.Exit(1)
	}

	users := db.NewUserRepo(database)
	if err := users.UpdatePasswordByEmail(*email, hash); err != nil {
		_ = database.Close()
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	_ = database.Close()
	fmt.Printf("password updated for %s\n", *email)
}
