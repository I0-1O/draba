# Development Log

---

## 2026-04-30 — Phase 2: API Foundation — DB & Auth

**Completed.** Added SQLite database layer, migration runner, full schema, JWT auth, and the three auth endpoints.

### What was built

**DB layer (`internal/db/`)**
- `db.go` — opens SQLite via `modernc.org/sqlite` (CGO-free) + `jmoiron/sqlx`; sets WAL mode and enables foreign keys
- `migrations.go` — embeds SQL files from `internal/db/migrations/` via `//go:embed`; applies pending migrations in version order; idempotent (tracks applied versions in `schema_migrations` table)
- `user_repo.go` / `invite_repo.go` — typed repository structs; all queries go through sqlx, never touching the handler layer directly

**Schema (`internal/db/migrations/001_initial_schema.sql`)**
All 12 tables: `users`, `teams`, `team_members`, `team_statuses`, `invites`, `api_tokens`, `events`, `event_tags`, `event_assignments`, `timelines`, `timeline_access`, `calendar_connections`

**Auth layer (`internal/auth/`)**
- `password.go` — bcrypt hash (cost 12) + verify
- `jwt.go` — `TokenService` issues HS256-signed access tokens (15 min TTL) and refresh tokens (7 day TTL); validates type claim to prevent refresh tokens being used as access tokens

**API layer (`internal/api/`)**
- `server.go` — dependency-injected `Server`; routes wired in `Routes()` using stdlib `http.ServeMux` method-pattern routing (Go 1.22+)
- `auth_handler.go` — `POST /auth/register` (invite-free for first user, invite token required thereafter), `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`
- `middleware.go` — Bearer token extraction + JWT validation; injects `*auth.Claims` into context
- `helpers.go` — `writeJSON`, `writeError`, `newID` (crypto/rand hex)

**Entry point**
- `cmd/draba/main.go` updated to open DB, run migrations, wire repos and token service, start server

### Exit criteria — all verified by automated tests
- `POST /auth/register` returns 201 + access/refresh tokens (first user, no invite needed)
- `POST /auth/register` returns 403 INVITE_REQUIRED for subsequent users without a token
- `POST /auth/login` returns 200 + tokens on valid credentials; 401 on wrong password
- `POST /auth/refresh` exchanges a refresh token for a new access token
- `GET /auth/me` returns the user profile with a valid access token; 401 without
- All 12 schema tables exist after migration (verified by `TestMigrate_Idempotent`)
- Re-running migrations produces no changes (idempotent)

### Decisions & notes
- Used `modernc.org/sqlite` (pure Go, no CGO) to keep the Docker build simple on non-CGO base images
- SQL files live at `internal/db/migrations/` (not top-level `migrations/`) because `//go:embed` forbids `..` path segments
- The top-level `migrations/` directory still exists with a copy of the SQL for documentation purposes; the embedded one at `internal/db/migrations/` is the authoritative source
- JWT refresh tokens are stateless (signed JWT, not stored in DB); cannot be individually revoked without a token blocklist — acceptable for v1, can be upgraded in Phase 9

---

## 2026-04-29 — Phase 1: Project Infrastructure

**Completed.** Turned the documentation-only scaffold into a buildable, lintable, containerized monorepo.

### What was built
- Go module initialized at `packages/api/` (`github.com/I0-1O/draba/packages/api`, `go 1.22.0`)
- Minimal Go HTTP server at `cmd/draba/main.go` with a single `GET /health` → `{"status":"ok"}` endpoint
- React + TypeScript + Vite project at `packages/web/` (manually scaffolded — see roadblocks)
- Tailwind CSS v4 wired via `@tailwindcss/vite` plugin; design tokens kept as `hsl()` values
- `pnpm-workspace.yaml` wiring all three packages
- `golangci-lint` config at `.golangci.yml`
- GitHub Actions CI (`ci.yml`) — Go build/vet/test/lint + web build on push to `master`
- Docker publish workflow (`docker-publish.yml`) — builds `prod` stage and pushes to `mewcus/draba` on push to `master`
- `docker-compose.yml` for local dev (API with Air hot-reload + Vite dev server)
- Container confirmed running in homelab (Portainer), health endpoint responding

### Roadblocks & resolutions

**`pnpm create vite` refused to run non-interactively in a non-empty directory**
Cancelled with "Operation cancelled" when the `packages/web/src/` files already existed.
→ Created all Vite project files manually (`package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, etc.)

**`corepack enable` failed with EPERM**
Needed admin rights to write to `C:\Program Files\nodejs\`.
→ Used `npm install -g pnpm` instead.

**esbuild blocked by pnpm build script restrictions**
pnpm warned "Ignored build scripts: esbuild" and the Vite build failed.
→ Added `"pnpm": { "onlyBuiltDependencies": ["esbuild"] }` to root `package.json`.

**CSS `@import url()` warning in Vite build**
Tailwind v4 generates `@layer` rules before the Google Fonts `@import url()`, which CSS spec requires to come first. Build warned on every run.
→ Moved font loading to `<link>` tags in `index.html` instead of `@import` in CSS.

**`go.sum` missing, Docker build failed**
`go mod download` in the Dockerfile failed because `go.sum` wasn't in the repo. `go mod tidy` doesn't create `go.sum` when a module has no external dependencies.
→ Committed an empty `go.sum` file.

**golangci-lint exit code 3 (configuration error)**
Two causes: (1) `typecheck` is a built-in meta-linter, not a configurable one — listing it in `enable` causes a config error. (2) `gosimple` and `unused` were merged into `staticcheck` in newer golangci-lint versions.
→ Removed `typecheck`, `gosimple`, and `unused` from `.golangci.yml`.

**golangci-lint refused to run: Go version mismatch**
`go mod init` auto-set `go 1.26.2` (the local installed version). golangci-lint v1.64.8 is built with Go 1.24 and refuses to lint modules targeting a newer Go version.
→ Lowered `go.mod` to `go 1.22.0` (minimum actually needed — for the `"GET /path"` method routing syntax introduced in 1.22). Also reverted Dockerfile back to `golang:1.23-alpine`.

**Node.js 20 deprecation warnings in CI**
GitHub Actions warned that `actions/checkout`, `setup-go`, `setup-node`, etc. run on Node.js 20 which is being deprecated.
→ Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env var to all CI jobs to opt into Node.js 24 now.

**Port conflict in homelab**
Port 8080 was already in use on the host.
→ Mapped container port 8080 to host port 8081 in Portainer. No code changes needed.
