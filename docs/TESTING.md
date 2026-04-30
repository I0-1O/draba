# Testing & Review Procedures

This document is the source of truth for what we test and how. It is consumed by the `/test-phase` and `/review-phase` slash commands, which fan work out to subagents that run in parallel. The framework grows phase-by-phase: every new ROADMAP phase adds a section here, and the subagents pick it up automatically.

For the human-review checklist used on diffs, see [REVIEW.md](REVIEW.md).

---

## Test environment setup (manual, do once per host)

These steps set up the docker host so `/test-phase` can run end-to-end. Do them **in this order** — later steps assume earlier ones are done.

### Step 1 — One-time host prep (manual)
On the docker host, as the `draba-test` user (created in the SSH setup steps below):

1. Copy `scripts/reset-test-env.sh` to `~/scripts/reset-test-env.sh` and `chmod +x` it.
2. Create `~/.draba-test.env` (chmod 600) with:
   ```
   DRABA_TEST_INVITE_TOKEN=<pick a long random string>
   DRABA_TEST_ADMIN_EMAIL=test-admin@local
   DRABA_TEST_INVITE_EMAIL=invitee@local
   DRABA_DB_DIR=/portainer/Files/AppData/Config/draba/data
   DRABA_CONTAINER=draba
   ```
   `DRABA_TEST_INVITE_EMAIL` is the email the api-smoke subagent registers as — it must match the email the invite was seeded for. Default `invitee@local` is fine.
   The script auto-sources this file at startup. No sudo, no `/etc/`, no compose dir — the script uses `docker stop/start` directly and runs file ops inside throwaway containers, so the host user only needs `docker` group membership.

### Step 2 — Per-run reset (manual or SSH-driven)
Before each `/test-phase` run that needs a clean DB, run on the docker host:
```bash
./scripts/reset-test-env.sh
```
This stops the container, wipes the SQLite file, restarts, waits for migrations, and seeds a bootstrap team + a known invite token. After it completes, the container is in a known state with `DRABA_TEST_INVITE_TOKEN` valid for `POST /auth/register`.

### Step 3 — Tell Claude how to reach it (one-time, on the dev box)
On the machine where you run Claude (this Windows box):
- The test URL should be stored in the `reference_test_docker.md` memory entry (not committed to the repo).
- Set `DRABA_TEST_INVITE_TOKEN` in your shell or in a memory entry so subagents can pass it through. **Do not commit it.**
- Configure key-based SSH from this box to the docker host so `/test-phase` can run the reset itself. Recommended setup: a dedicated `draba-test` user on the docker host, an ed25519 keypair with a passphrase loaded in `ssh-agent`, and the public key pinned in `authorized_keys` with `command="/usr/local/bin/draba-reset"` plus `no-pty,no-port-forwarding,no-X11-forwarding,no-agent-forwarding` so the key can only run the reset script. Add an SSH config alias `Host draba-test` so the call is just `ssh draba-test`.

### What's manual vs automated, at a glance

| Step | Where it runs | Who does it |
|---|---|---|
| Host prep (Step 1) | Docker host | **You, once** |
| Reset before a test run (Step 2) | Docker host | **You manually** *(or SSH-driven if configured — Claude can trigger)* |
| Static checks, unit tests, schema check, security review | Dev box (this machine) | Claude |
| API smoke against live container | Dev box → live container | Claude |
| Logging the run to `docs/log.md` | Dev box | Claude |

---

## Global procedures

These run regardless of phase.

### Static checks
- `cd packages/api && golangci-lint run`
- `cd packages/api && go vet ./...`
- `pnpm --filter web lint`
- `pnpm --filter web build`

### Unit & integration
- `cd packages/api && go test -count=1 ./...`
- Race detector (`-race`) requires CGO/GCC — not available on the Windows dev box. It runs in CI (GitHub Actions, Linux runner) on every push. Do not mark a local run as failed for omitting `-race`.

### Live smoke target
Live-smoke subagents (`api-smoke`, future `ws-smoke`) hit a running container. The URL is **not** stored in the repo — it's resolved at runtime in this priority order:
1. `DRABA_TEST_URL` environment variable, if set.
2. The `reference_test_docker.md` memory entry (Brian's local LAN host).
3. If neither is available, the subagent reports **skipped**, not failed.

### Review checklist (always)
- CONVENTIONS.md compliance
- No scope creep beyond the phase's ROADMAP entry
- Errors handled at boundaries (HTTP, DB, external APIs); internal calls trust contracts
- No secrets, no `.env` files, no host-specific values committed
- Migrations idempotent (re-run produces no diff)
- `docs/log.md` updated with a dated entry

---

## Subagent map

| Subagent | Scope | Active from |
|---|---|---|
| `static-check` | lint + vet + web typecheck/build | Phase 1 |
| `unit-test` | `go test -race -count=1 ./...` | Phase 2 |
| `schema-check` | run migrations on fresh SQLite, re-run, assert no diff | Phase 2 |
| `api-smoke` | hit live container, run phase exit-criteria flows via curl | Phase 2 |
| `security-review` | scan diff for secrets, missing auth, SQL concat, JWT misuse | Phase 2 |
| `type-sync` *(future)* | regen OpenAPI types, assert no diff | Phase 4 |
| `ws-smoke` *(future)* | WebSocket: team-scoped broadcast within 500ms, heartbeat | Phase 5 |
| `web-e2e` *(future)* | Chrome MCP — login, render timeline, drag-create | Phase 7 |

`/test-phase N` spawns every subagent whose "active from" phase ≤ N. Each subagent reads its own section below for the exact assertions, so adding tests later is a doc edit, not a command edit.

---

## Per-phase procedures

### Phase 1 — Project Infrastructure

**static-check**
- `go build ./...` from `packages/api/` succeeds with no errors
- `pnpm build` from `packages/web/` succeeds
- `golangci-lint run` is clean
- `docker compose config` parses without error — skip if Docker is not installed on the dev box (verified by CI)

### Phase 2 — API Foundation (DB & Auth)

**unit-test**
- All `*_test.go` under `packages/api/internal/` pass with `-race -count=1`

**schema-check**
- Start container against a fresh `data.db`; confirm these tables exist: `users`, `teams`, `team_members`, `team_statuses`, `invites`, `api_tokens`, `events`, `event_tags`, `event_assignments`, `timelines`, `timeline_access`, `calendar_connections`
- Restart the container; assert migration runner produces no schema changes (idempotency)

**api-smoke** (against `$DRABA_TEST_URL`)
- `POST /auth/register` with a valid invite token → 200/201, returns user + JWT
- `POST /auth/register` with an invalid/missing invite token → 4xx
- `POST /auth/login` with the registered credentials → 200, returns JWT
- `POST /auth/login` with bad credentials → 401
- `POST /auth/refresh` with a valid refresh token → 200, returns new JWT
- A subsequent authenticated request with the issued JWT → 200 (validates signing)

**security-review**
- No password fields stored in plaintext (grep migrations + handlers)
- JWT secret loaded from env/config, not hardcoded
- Invite tokens single-use (consumed on register)
- No SQL string concatenation in queries

### Phase 3 — Core API (Events & Teams)

*Stub — populate during/after Phase 3 implementation.*

**api-smoke** (planned)
- `POST /teams` → returns team
- `POST /teams/:id/invites` → returns invite token
- Register via that token → user appears in `GET /teams/:id/members`
- `POST /teams/:id/events`, then `GET /teams/:id/events?from=…&to=…` returns it
- `PATCH /events/:id` updates fields; `DELETE /events/:id` removes it (subsequent GET excludes)
- Auth: every endpoint rejects requests without a valid JWT (401)
- Authz: a user not on the team cannot read or mutate that team's events (403)

**security-review** (planned)
- Every new route requires auth middleware
- Team membership enforced on every team-scoped endpoint

### Phase 4 — OpenAPI Spec & Type Generation

*Stub.*

**type-sync** (planned)
- `pnpm generate` succeeds with no errors
- `git diff` after generate is empty (committed types match spec)
- All Phase 2–3 endpoints present in `packages/shared/openapi.yaml`

### Phase 5 — Real-Time (WebSocket)

*Stub.*

**ws-smoke** (planned)
- Two clients on team A both receive a delta within 500ms of an event mutation
- A client on team B does not receive team A's events
- 30s heartbeat keeps idle connection alive

### Phase 6 — Timelines

*Stub.* api-smoke: create + fetch with JWT, public share token works, non-access-list user gets 403.

### Phase 7+ — Web

*Stubs.* `web-e2e` via Chrome MCP picks up at Phase 7. Detailed assertions added when each phase begins.

---

## Adding tests for a new phase

1. Find the phase's section in this file (or add one if missing).
2. Under the relevant subagent heading, list concrete, runnable assertions tied to the ROADMAP exit criteria.
3. If a new subagent is needed, add it to the subagent map with an "active from" phase.
4. That's it — `/test-phase` will pick it up on the next run.
