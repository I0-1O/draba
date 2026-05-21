# packages/shared

The API contract layer. Contains the OpenAPI specification and generated TypeScript types.

## Contents
- `openapi.yaml` — the OpenAPI 3.x specification for the draba REST API. This is the single source of truth for the API shape.
- `src/` — TypeScript types generated from `openapi.yaml` (generated, do not edit by hand)

## Generating Types
```bash
pnpm --filter shared generate
```
This runs `openapi-typescript` against `openapi.yaml` and writes to `src/index.ts`.

## Usage in packages/web
```ts
import type { Activity, Team, Timeline } from '@draba/shared'
```

## Important
- Do not hand-edit files in `src/` — they are generated and will be overwritten
- When adding or changing an API endpoint, update `openapi.yaml` first, then regenerate types
- The Go structs in `packages/api/internal/models/` should mirror the OpenAPI schemas
