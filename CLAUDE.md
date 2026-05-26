# draba

## Overview
draba is a team coordination and planning tool for small-to-medium teams. It occupies the space between a shared calendar (too simple) and a full project management suite (too complex). The core mental model is **Person + Time Range + Work** — teams see who is working on what, at a glance, in a shared timeline view.

## Context Loading Protocol

**At the start of a session** — read `docs/ai-context/session-state.md` first. It is a short snapshot of current phase status, recent unfiled bug fixes, known open issues, and the recommended starting point. This replaces reading TASKS.md + log.md + ROADMAP.md from scratch.

**Looking up a type, struct field, or component prop** — grep `docs/ai-context/repomap.md` for the symbol name instead of a full codebase search. Do not read the file wholesale; it is 1.3 MB and exceeds the Read tool's limit. Use targeted lookups only:
```
Grep("MemberDetail", "docs/ai-context/repomap.md", output_mode="content")
```

**Before writing code** — if the file in question is listed in the repomap directory structure, read it directly with the Read tool before editing. Do not infer signatures from memory.

## Tech Stack
- Backend: Go (single binary, self-hosted first)
- Frontend: React (TypeScript) + shadcn/ui + Tailwind CSS
- Database: SQLite (default), MySQL/MariaDB, Postgres (configurable)
- Calendar sync: Google Calendar API, CalDAV (iOS/macOS) — Microsoft/Outlook is v2
- Deployment: Docker (primary), direct binary install
- Real-time: WebSockets

## Key Principles
- **Ruthlessly resist feature creep.** The product succeeds by doing one thing extremely well.
- **API-first.** Every client (web, CLI, MCP) is a consumer of the same API.
- **Event-driven.** Every state change emits an internal event. Calendar sync, WebSocket broadcast, and notifications are all event consumers.
- **Self-hosted by default.** The product must run as a single Docker container with zero external dependencies.
- **The app is the source of truth.** Calendars are read projections, not the data store.
- **No paid dependencies without approval.**

## Project Structure
- `packages/api/` — Go API server (REST + WebSocket)
- `packages/web/` — React web frontend
- `packages/shared/` — OpenAPI spec + generated TypeScript types
- `docs/` — Architecture, requirements, design, tasks
- `skills/` — Reference docs for Claude (how to do things)
- `.claude/commands/` — Reusable slash commands

## Working Agreements
- Always run `golangci-lint run` before committing Go code
- Always run `pnpm --filter web lint` before committing frontend code
- Always run `pnpm --filter api test` after changes to the API
- Read `docs/REQUIREMENTS.md` before starting new features
- Read `docs/ARCHITECTURE.md` before making structural changes
- Check `docs/TASKS.md` for current priorities
- Check `docs/ROADMAP.md` to understand which phase we're in and what the exit criteria are

## References
- [docs/ai-context/session-state.md](docs/ai-context/session-state.md) — **Read first.** Current phase status, recent fixes, open issues, next steps
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — What the app does
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — How the system is built
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — Code style and patterns
- [docs/TASKS.md](docs/TASKS.md) — Current backlog and priorities
- [docs/ROADMAP.md](docs/ROADMAP.md) — Phased development timeline with effort estimates and exit criteria
- [docs/design/DESIGN_SYSTEM.md](docs/design/DESIGN_SYSTEM.md) — Visual design tokens
- [docs/design/UX_PATTERNS.md](docs/design/UX_PATTERNS.md) — Interaction patterns
- [skills/go-comments.md](skills/go-comments.md) — Go comment conventions (package headers, exported doc comments, inline why-comments)
- [skills/ts-comments.md](skills/ts-comments.md) — TypeScript/React comment conventions (file headers, TSDoc on exports, inline why-comments)
