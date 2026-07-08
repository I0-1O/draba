# Phase 16 — Backup & Restore

**UI name:** "Backup" (new admin-only section on the Settings page, alongside SMTP / Organization).

**Status:** 🟢 Planned — scope settled (2026-07-08). This plan supersedes the ROADMAP §16 directional scope and resolves its three open questions.

---

## What we're actually building

Give a self-hosted admin confidence their data is safe without SSH-ing into the container: a read-only status surface (where the database is, how big, when it was last backed up, whether that's recent enough), a "Back up now" button that produces a real, verified copy, and a scheduler that does it unattended with retention cleanup and failure notification.

The through-line: **a backup you haven't verified and can't find is not a backup.** Every backup this phase produces is integrity-checked at creation, lands in a well-known directory on a mounted volume, and is listed (with size and timestamp) in the UI. The health indicator makes staleness impossible to miss.

### Scope correction vs. the ROADMAP text (2026-07-08 codebase scan)

The ROADMAP §16 text included MySQL/Postgres surfaces (`pg_dump`/`mysqldump` triggers, connection-string display). **Cut entirely: the API is SQLite-only today** — `go.mod` has no mysql/pgx/pq driver; `DRABA_DB_DRIVER` values other than `sqlite` are aspirational. The backup subsystem is built against SQLite, with a clean seam (a `backup.Engine` interface with one implementation) so a dump-based engine can slot in when other adapters actually land. No speculative code for databases we can't open.

### Decisions locked (2026-07-08)

1. **Hot copy via `VACUUM INTO`** *(resolves ROADMAP open question 2)*. Under WAL mode `VACUUM INTO` takes a consistent read snapshot without blocking concurrent writers, runs as a single SQL statement over the existing `*sql.DB` (no C-level backup API — relevant since we're on the pure-Go `modernc.org/sqlite` driver), and produces a compacted, standalone, WAL-free file. Every backup is verified immediately after creation with `PRAGMA integrity_check` against the *copy* — a backup that fails verification is deleted and reported as a failure, never left on disk looking like a backup.
2. **Backup history is a directory scan, not a DB table** *(new question the ROADMAP didn't ask)*. Recording backups inside the database being backed up is self-defeating — after a restore, the table would describe a different timeline than the directory. The filename is the record: `draba-20260708T020000Z-scheduled.db` / `-manual.db` (UTC, sortable, trigger type visible). History = list the backup dir, filter on the pattern, stat for size/mtime. No migration needed for history; one `instance_settings` key for schedule config.
3. **Backups land on the data volume by default: `DRABA_BACKUP_DIR`, default `/data/backups`** *(the Docker contract the ROADMAP missed)*. `/data` is already the mounted volume (`DRABA_DB_DSN` defaults to `/data/draba.db`), so backups survive container recreation with zero new configuration. Same-disk backups protect against bad migrations, botched imports, and accidental deletion — not disk loss; the ops doc says exactly that and shows how to point `DRABA_BACKUP_DIR` at a second mount. Startup validates the dir is creatable + writable and the status endpoint reports it.
4. **No backup download from the admin UI in v1** *(resolves ROADMAP open question 1, on the conservative side)*. The backup file is the entire instance — every team's data, password hashes, encrypted SMTP credentials. Serving it over HTTP behind a bearer token is a single-credential-compromise-away from total exfiltration, and the convenience case is thin (a self-hosting admin has filesystem access by definition). Filesystem/volume only; revisit only with real demand.
5. **No backup encryption at rest in v1** *(resolves ROADMAP open question 3, as the ROADMAP leaned)*. The backup sits next to the live DB with the same filesystem permissions; encrypting one and not the other is theater. Note-in-doc: encrypt at the volume/filesystem layer if required.
6. **Restore is a documented runbook + startup log line, not a UI.** In-app restore means the running server replacing its own open database — a rabbit hole of connection draining and half-states, for an action taken once a year under stress. v1: `docs/OPERATIONS.md` runbook (stop container → copy backup over `draba.db`, remove `-wal`/`-shm` → start). Backups are standard SQLite files; the procedure is `cp`. The server already logs the DB path at boot, which doubles as restore confirmation.
7. **Schedule = presets, not cron expressions.** `off | hourly | every6h | every12h | daily@HH:MM | weekly@day+HH:MM`, stored as one JSON value in `instance_settings` (the 010 key/value store — no new table). Presets cover the real use cases, need no cron-parser dependency, and render as a two-dropdown UI instead of a syntax textbox. Default for new instances: **daily at 02:00, keep 14** — safe-by-default beats opt-in for a data-safety feature; the admin page shows what's configured.
8. **Retention = keep-last-N** (default 14), enforced after every successful backup, counting only files matching our filename pattern (a hand-copied `pre-upgrade.db` the admin dropped in the dir is never touched). One knob; age-based expiry is a second knob v1 doesn't need.
9. **Scheduler is a purpose-built goroutine, not a job framework.** `internal/backup.Scheduler`: compute next-run from the preset, `time.Timer` until then, run, repeat; config changes signal a recompute; clock injected for tests. This is the first background scheduler in the codebase — resist the urge to generalize it (feature-creep principle); a second consumer can extract the pattern later.
10. **Backups emit bus events** (`backup.completed` / `backup.failed`) per the event-driven principle. Failure notification (SMTP to superadmins, silent no-op when SMTP is unconfigured) is an event consumer, not scheduler code — same shape as every other side effect in the app.
11. **Concurrency guard:** one backup at a time, enforced with a mutex/atomic in the manager. Manual trigger while one runs → `409 BACKUP_IN_PROGRESS`. Scheduled tick while one runs → skipped with a log line.

---

## Reused infrastructure (do not rebuild)

| Concern | Existing asset | Notes |
|---|---|---|
| Admin auth | `requireSuperadmin` (`internal/api/admin_handler.go`) | Every backup endpoint uses the same guard; route family `/admin/backup*` beside `/admin/smtp`. |
| Config storage | `instance_settings` key/value (migration 010) + `InstanceSettingsRepo` | Schedule config = one JSON value under `backup.schedule`. No new table, no new migration. |
| Failure email | `internal/mailer` (SMTP config, encrypted password, send path) | Consumer sends via the existing mailer; unconfigured SMTP = skip silently (health indicator still shows staleness). |
| Event bus | `internal/events` | `backup.completed` / `backup.failed`; notification consumer subscribes. Instance-scoped events — **not** broadcast to team WebSocket clients. |
| Env config pattern | `getenv` in `cmd/draba/main.go`, `DRABA_*` family | `DRABA_BACKUP_DIR` joins `DRABA_DB_DSN` etc.; documented in `packages/api/CLAUDE.md` env block. |
| Wiring | `cmd/draba/main.go` (repos → server; `go hub.Run()` precedent) | `backup.Manager` constructed with the DB + dsn + dir; `go scheduler.Run(ctx)` beside the hub. |
| Settings UI | `SettingsPage.tsx` admin section, SMTP form patterns, `useSettings.ts` | Backup section follows the SMTP card's superadmin-gating and form conventions; shadcn components throughout. |
| DB size / WAL facts | `DRABA_DB_DSN` path + `os.Stat` on `draba.db` / `draba.db-wal` | Status endpoint is file stats + one `PRAGMA`; no new introspection layer. |

---

## API

All endpoints superadmin-only (`requireSuperadmin`), JSON, in the `/admin/backup` family.

### `GET /admin/backup/status`

```jsonc
{
  "database": { "driver": "sqlite", "path": "/data/draba.db", "sizeBytes": 1234567, "walSizeBytes": 32768, "modifiedAt": "…" },
  "backupDir": { "path": "/data/backups", "writable": true },
  "lastBackup": { "filename": "draba-20260708T020000Z-scheduled.db", "sizeBytes": 1200000, "createdAt": "…", "trigger": "scheduled" }, // null when none
  "health": "ok",            // ok (<24h) | stale (1–7d) | critical (>7d or none) — thresholds fixed in v1
  "running": false,
  "schedule": { "preset": "daily", "time": "02:00", "keepLast": 14 }  // null = disabled
}
```

### `POST /admin/backup`

Runs `VACUUM INTO` a temp name in the backup dir → `PRAGMA integrity_check` on the copy → rename to final `-manual` name → retention sweep → emit event. Synchronous (seconds at this product's DB sizes; simplest correct thing — an async job adds state for no v1 benefit). Returns `201` with the history entry. `409 BACKUP_IN_PROGRESS` under the concurrency guard; `500` with the reason (and no leftover file) on failure.

### `GET /admin/backup/history`

Directory scan, pattern-filtered, newest first: `{ "backups": [ { "filename", "sizeBytes", "createdAt", "trigger" } ] }`. Filesystem is the source of truth — files deleted out-of-band just disappear; foreign files never appear.

### `DELETE /admin/backup/{filename}`

Deletes one backup. Filename must **exactly match the backup pattern** (regex, no separators accepted) and resolve inside the backup dir — the pattern check is the path-traversal guard. `404` unknown, `204` deleted. (ROADMAP said `:id`; the filename *is* the id per decision 2.)

### `GET /admin/backup/schedule` / `PUT /admin/backup/schedule`

Read/write `{ "preset": "off|hourly|every6h|every12h|daily|weekly", "time": "HH:MM", "day": "mon…sun", "keepLast": 1–365 }` (`time` for daily/weekly, `day` for weekly; validated). PUT persists to `instance_settings` and pokes the scheduler to recompute; response echoes config + `nextRunAt`.

### OpenAPI

`BackupStatus`, `BackupEntry`, `BackupSchedule` schemas; regenerate TS types into `packages/shared`.

---

## Server internals — `internal/backup`

- **`Engine`** — `Backup(ctx, destPath) error` + `Verify(ctx, path) error`. One implementation, `sqliteEngine` (`VACUUM INTO` + `integrity_check`). The seam for future dump-based engines; deliberately tiny.
- **`Manager`** — owns dir + naming + concurrency guard; `RunNow(trigger)` does temp-name → verify → rename → retention → event (rename-last means an interrupted backup never leaves a pattern-matching corpse); `History()`, `Delete(filename)`, `Status()`.
- **`Scheduler`** — goroutine: load config → compute next run (injected clock) → timer → `Manager.RunNow("scheduled")` → recompute. Missed windows (container down at 2am) are **not** made up on boot in v1 — next window just runs; the health indicator covers the gap honestly.
- **Notification consumer** — subscribes to `backup.failed`, emails superadmins via `mailer` (subject + error + doc pointer), no-ops silently without SMTP config.

Failure modes handled explicitly (each a table-driven test): backup dir missing/unwritable (status flags it; run fails cleanly), disk full mid-vacuum (temp file removed, `backup.failed`), verify failure (copy deleted, failure reported), process killed mid-backup (temp name never matches the pattern → invisible to history, overwritten next run).

---

## Web — Settings › Backup

Superadmin-only section on the Settings surface (same gating as SMTP), one page, four blocks:

1. **Status card** — DB path/size/WAL size/last-modified; health badge (green *Backed up 3h ago* / amber *Last backup 4 days old* / red *No backups yet*) with the thresholds spelled out in the sublabel; backup-dir path with an inline warning when `writable: false`.
2. **Back up now** — button → `POST /admin/backup` → spinner (sync call) → toast + refetch. Disabled with *Backup in progress…* when `running`.
3. **Schedule card** — preset dropdown, time picker (daily/weekly), day picker (weekly), keep-last-N input; save → PUT; shows *Next backup: …* from `nextRunAt`.
4. **History table** — filename, created, size, trigger chip, delete (confirm dialog names the file). Empty state points at Back up now.

Hooks: `useBackupStatus` / `useBackupHistory` / `useBackupSchedule` + mutations (TanStack, `useSettings.ts` conventions). Status refetches on window focus; no WebSocket wiring (admin page, not a live surface).

---

## Sub-phases

### 16.1 — Server: engine, manager, manual backup + status/history API (M, ~1 day)
`internal/backup` (`Engine`, `sqliteEngine`, `Manager`), `DRABA_BACKUP_DIR` wiring + startup validation, the four non-schedule endpoints, OpenAPI + regenerated types. Tests: vacuum-under-concurrent-writes, verify-failure cleanup, filename pattern (parse/format round-trip, foreign files excluded, traversal attempts rejected), retention sweep, concurrency guard, full status shape. **Pausable:** manual backup alone is already the core value.

### 16.2 — Server: scheduler, retention-in-anger, failure notification (M, ~1 day)
`Scheduler` (injected clock; next-run computation table-tested across presets/DST-less UTC), schedule GET/PUT + validation, `instance_settings` persistence, default-on (daily 02:00 / keep 14) for instances with no stored config, bus events + SMTP failure consumer, `main.go` wiring. Tests: fake-clock runs across every preset, config-change recompute, skip-while-running, failure → one email to each superadmin, no-SMTP no-op.

### 16.3 — Web UI + ops docs + hardening (M, ~1 day)
Settings › Backup section (four blocks above), hooks, component tests (health badge states, schedule form validation, delete confirm, in-progress disable). `docs/OPERATIONS.md`: restore runbook, volume contract (`DRABA_BACKUP_DIR` default + second-mount example), docker-compose snippet; `packages/api/CLAUDE.md` env-block update. Live verification against the test Docker instance (real backup of the real seeded DB, restore-runbook walked through once for real). `/test-phase 16`, TESTING.md Phase 16 assertions, log.md + session-state updates.

---

## Cut from scope (v1)

- **MySQL/Postgres backup** — no drivers exist in the codebase; the `Engine` seam is the whole concession to the future.
- **Backup download over HTTP** — decision 4. Revisit with demand, not speculatively.
- **In-app restore** — runbook instead; decision 6.
- **Backup encryption at rest** — decision 5.
- **S3/object-storage targets** — the ROADMAP's own stretch goal; local dir only. An S3 target is a natural second `Engine`-adjacent feature *after* someone asks.
- **Cron-expression schedules** — presets; decision 7.
- **Catch-up runs for missed windows** — health indicator + next window instead.
- **Success notifications** — failure-only email; a daily "backup OK" email trains people to ignore email.

---

## Exit criteria — safe to pause when

- The Settings › Backup page shows the live DB path, size, WAL size, and an honest health badge on a fresh instance (red *No backups yet*) and after a backup (green, timestamped)
- **Back up now** produces a file in `DRABA_BACKUP_DIR` that passes `PRAGMA integrity_check` and — walked through once for real against the test Docker instance — restores via the runbook into a working draba with the same data
- A scheduled backup fires at the configured preset time without any request traffic, and the history table shows it with the `scheduled` trigger
- Retention: with keep-last-2 configured, a third backup deletes the oldest; a foreign file in the directory is never touched and never listed
- A second backup request during a running backup returns `409`; the UI disables the button while `running`
- With SMTP configured, an induced backup failure (unwritable dir) emails the superadmin; without SMTP, it fails loudly in status/logs and silently skips email
- `DELETE` with a path-traversal-shaped filename is rejected; only pattern-matching files are deletable
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean; `pnpm --filter web test` passes
