# packages/web

This is the draba web frontend. React + TypeScript + Vite.

## Key Directories
- `src/components/` — shared UI components
- `src/pages/` — top-level route pages
- `src/hooks/` — custom hooks (data fetching, WebSocket, drag-and-drop)
- `src/lib/` — API client, utilities
- `src/types/` — re-exports from generated types in `packages/shared/`

## Run
```bash
pnpm --filter web dev
```

## Build
```bash
pnpm --filter web build
```

## Test
```bash
pnpm --filter web test
```

## Lint
```bash
pnpm --filter web lint
```

## Key Dependencies (intended)
- `@tanstack/react-query` — server state (fetching, caching, mutations)
- `react-router-dom` — routing
- `tailwindcss` — utility-first CSS
- shadcn/ui components — live in `src/components/ui/` (copy-paste, not a runtime dep)
- `openapi-typescript` generated types from `packages/shared/openapi.yaml`

## shadcn/ui
- Add components via CLI: `pnpm dlx shadcn@latest add <component>`
- Components land in `src/components/ui/` — edit them freely, they're owned by the repo
- Design tokens live in `src/index.css` as CSS custom properties (HSL values)
- Dark mode: class-based (`dark` on `<html>`)

## Conventions
See `docs/CONVENTIONS.md` for React, TypeScript, and component patterns.

## Notes
- In production, the built static files are embedded in the Go binary — no separate static server
- All API types come from generated types in `packages/shared/` — do not hand-write API response types
