# Review Checklist

Used by `/review-phase` (and human reviewers) when evaluating the diff for a completed phase. For test procedures, see [TESTING.md](TESTING.md).

## Scope
- Diff stays inside the phase's ROADMAP scope. Out-of-scope changes are flagged for a separate PR.
- No new features, abstractions, or refactors that the phase did not call for.
- No premature generalization (no "future-proof" hooks, configs, or interfaces with only one caller).

## Correctness
- Every ROADMAP exit criterion for the phase is verifiable from the diff or a test.
- Error handling at boundaries (HTTP, DB, external APIs) only — internal calls trust contracts.
- No silent failures: errors are returned, logged at the right level, or both.

## Security
- No secrets, tokens, or host-specific values in the diff (grep for `epcot.lan`, `8081`, `BEGIN PRIVATE KEY`, `password =`).
- New routes wired through auth middleware unless explicitly public.
- Authorization checked, not just authentication (team membership, ownership).
- No SQL string concatenation; parameterized queries only.
- Password handling uses the project's hash helper; never stored or logged in plaintext.

## Data
- Migrations are forward-only and idempotent (re-run is a no-op).
- No destructive migrations without explicit acknowledgement in the commit message.

## Tests
- New code paths have at least one test, OR the diff documents why not.
- Tests use real SQLite (in-memory is fine), not mocks of the DB layer.
- No `t.Skip` or commented-out assertions left in.

## Conventions & docs
- CONVENTIONS.md style followed (naming, file layout, error wrapping).
- Comments explain *why*, not *what*. No tutorial-style docstrings.
- Public API changes reflected in OpenAPI spec (Phase 4+).
- `docs/log.md` has a dated entry for this phase's work.
- `docs/ROADMAP.md` and `docs/TASKS.md` reflect the new status.

## Hygiene
- No `console.log`, `fmt.Println`, or debugger statements left behind.
- No commented-out code blocks.
- No unused imports, vars, or files.

## Output format
`/review-phase` should report findings as a table grouped by severity: **blocker / suggestion / nit**. Each finding cites a `file:line` and a one-line rationale. Empty categories are omitted.
