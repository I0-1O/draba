# Conventions

## Go (packages/api)

### Formatting and Linting
- Formatter: `gofmt` / `goimports` (run on save)
- Linter: `golangci-lint` — run before every commit
- No `//nolint` comments without an explanation

### Project Layout
- Follow [standard Go project layout](https://github.com/golang-standards/project-layout)
- `cmd/draba/` — entry point only; wires dependencies, starts server
- `internal/` — all application code; not importable outside the module
- No `pkg/` unless a package is genuinely intended to be used by external consumers

### Naming
- Packages: short, lowercase, no underscores (`auth`, `models`, `caldav`)
- Files: lowercase, underscores for multi-word (`event_handler.go`, not `eventHandler.go`)
- Exported types: PascalCase; unexported: camelCase
- Interfaces: describe behavior, not implementation (`EventRepository`, not `EventStore`)

### Error Handling
- Always handle errors explicitly — no `_` discards on errors that matter
- Wrap errors with context: `fmt.Errorf("creating event: %w", err)`
- Return errors to callers; handlers convert them to HTTP responses at the boundary
- No panics in handler or business logic code

### Testing
- Framework: standard library + `testify`
- Co-locate tests with source: `event_handler_test.go` next to `event_handler.go`
- Integration tests hit a real SQLite database — no mocking the DB layer
- Naming: `TestCreateEvent_AssignsMultipleUsers`, `TestCalDAVSync_UpdatesExistingEvent`

### API Handlers
- Handlers are thin: validate input, call service, return response
- No business logic in handlers — all logic lives in `internal/` service packages
- No direct DB access from handlers — always go through the repository layer

---

## React (packages/web)

### Language
- TypeScript strict mode — no `any`, no type assertions without a comment explaining why
- All types for API responses come from generated types in `packages/shared/` — do not hand-write API types

### Components
- Functional components only — no class components
- One component per file; file name matches component name (`TimelineView.tsx`)
- Files: PascalCase for components, camelCase for hooks and utilities
- Co-locate styles, tests, and types with the component when practical

### State Management
- TanStack Query (`@tanstack/react-query`) for all server state (fetching, caching, mutations)
- Local UI state: React `useState` / `useReducer`
- Global UI state (theme, current user, WebSocket connection): Context or Zustand — TBD when needed
- No Redux

### Hooks
- Custom hooks prefixed with `use` (`useTimeline`, `useWebSocket`)
- Extract logic from components early — components should read almost like markup

### Naming
- Components: PascalCase (`TimelineBlock`, `TeamMemberList`)
- Hooks: camelCase with `use` prefix (`useEventDrag`, `useTeam`)
- Event handlers: `handleX` prefix (`handleBlockDrop`, `handleInviteSubmit`)

### Testing
- Framework: Vitest + React Testing Library
- Test behavior, not implementation — query by role/label, not by class
- e2e: Playwright for critical paths (TBD)

---

## API Design

### REST
- Resource naming: plural nouns (`/events`, `/teams`, `/timelines`)
- Hierarchical where it makes sense: `GET /teams/:teamId/events`
- HTTP methods as intended: GET reads, POST creates, PATCH partial update, DELETE removes
- Responses always include the full updated resource on create/update
- Errors: `{ "error": { "code": "INVITE_EXPIRED", "message": "..." } }`

### WebSocket
- Connect at `/ws?token=<jwt>`
- Client sends: `{ "type": "subscribe", "teamId": "..." }`
- Server sends: `{ "type": "event.updated", "payload": { ... } }`
- Server sends a heartbeat `{ "type": "ping" }` every 30s; client must pong

---

## Git

### Branch Naming
- `feat/short-description` — new feature
- `fix/short-description` — bug fix
- `chore/short-description` — tooling, deps, non-feature work
- `docs/short-description` — documentation only

### Commit Format
Conventional commits:
```
feat: add CalDAV sync for iOS calendar
fix: prevent duplicate event_assignments on upsert
chore: upgrade golangci-lint to v1.57
docs: document WebSocket message protocol
```

### Pull Requests
- Each PR references a task from `docs/TASKS.md`
- PRs should be small and focused — one logical change
- All CI checks must pass before merge

---

## Anti-Patterns to Avoid
- No business logic in HTTP handlers or React components — logic belongs in services and hooks
- No direct database access outside of `internal/db/` repository packages
- No `console.log` in committed React code — use a logger or remove before commit
- No god components over ~300 lines — split early
- No hand-written TypeScript types that duplicate the OpenAPI-generated types
- No `any` in TypeScript without a `// reason:` comment
