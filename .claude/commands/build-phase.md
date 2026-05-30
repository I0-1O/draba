Read docs/ROADMAP.md and identify the phase specified in $ARGUMENTS (e.g. "1" or "Phase 1").

1. Read the phase's scope and exit criteria from ROADMAP.md.
2. Find the corresponding tasks in docs/TASKS.md.
3. Read any referenced docs (ARCHITECTURE.md, CONVENTIONS.md, REQUIREMENTS.md) relevant to this phase before writing any code.
4. Update the phase status in ROADMAP.md from ⬜ to 🔄 before starting work.
5. Implement every task in the phase's scope, following CONVENTIONS.md throughout.
6. After implementation, run all of the following checks in order — all must pass before marking the phase done:
   - **Go:** `golangci-lint run` then `go test ./...`
   - **Web lint:** `pnpm --filter web lint` (runs `tsc --noEmit` — catches type errors in isolation)
   - **Web build:** `pnpm --filter web build` (runs `tsc -b && vite build` — catches additional errors that `--noEmit` misses, such as missing fields on exported interfaces, composite project reference issues, and import graph problems). This is the same build CI runs; skipping it is the most common source of "passes locally, fails in CI" build errors.
   - Fix any errors found before proceeding, even if they're in files you didn't directly touch.
   Suggest running `/test-phase <N>` and `/review-phase <N>` to fan the verification out across subagents in parallel.
7. Check off completed items in TASKS.md.
8. Update the phase status in ROADMAP.md:
   - If all exit criteria pass: ✅ Done, add the completion date.
   - If any exit criterion fails or needs manual verification: mark 🔄 In Progress and add a note listing what still needs review.
9. Summarize what was built and which exit criteria were verified vs. which need manual testing by the user.
