# packages/api

This is the draba API server. Go, REST + WebSocket, with a built-in CalDAV server.

## Entry Points
- `cmd/draba/main.go` — wires dependencies, starts HTTP server
- `migrations/` — SQL migration files, run automatically on startup

## Key Internal Packages
- `internal/api/` — HTTP handlers and routing (thin — no business logic)
- `internal/auth/` — JWT, invite tokens, password hashing
- `internal/caldav/` — built-in CalDAV server implementation
- `internal/calendar/` — Google Calendar OAuth + sync; CalDAV outbound sync
- `internal/db/` — repository layer; adapters for SQLite, MySQL, Postgres
- `internal/events/` — internal event bus (pub/sub for state changes)
- `internal/models/` — domain types shared across packages
- `internal/ws/` — WebSocket hub and broadcaster

## Run
```bash
go run ./cmd/draba
```

## Test
```bash
go test ./...
```

## Lint
```bash
golangci-lint run
```

## Environment Variables
```
DRABA_DB_DRIVER=sqlite          # sqlite | mysql | postgres
DRABA_DB_DSN=./draba.db         # file path for SQLite, connection string for others
DRABA_JWT_SECRET=               # required — random secret for signing JWTs
DRABA_PORT=8080                 # default 8080
DRABA_LOG_LEVEL=info            # debug | info | warn | error (default info; set debug in docker-compose for dev)
DRABA_GOOGLE_CLIENT_ID=         # required for Google Calendar sync
DRABA_GOOGLE_CLIENT_SECRET=     # required for Google Calendar sync
DRABA_BASE_URL=                 # public URL of the server (used for OAuth callbacks, CalDAV URLs)
```

## Conventions
See `docs/CONVENTIONS.md` for Go patterns, error handling, and testing conventions.
See `skills/go-comments.md` for comment conventions (package headers, exported doc comments, when to use inline comments). Apply these whenever writing or editing Go code.
