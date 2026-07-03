# Phase 15 — Import — Tabular

**UI name:** "Bulk import" (already stubbed in the sidebar's new-activity split button, `Sidebar.tsx` `onBulkImport`).

**Status:** 🟢 Planned — scope settled (2026-07-03). This plan supersedes the ROADMAP §15 summary and resolves its two open questions.

---

## What we're actually building

Get data *into* draba from a spreadsheet — CSV / Excel upload with a mandatory preview + validation pass before any row is written. The round-trip companion to Phase 14 export, and the seam through which a team migrates off whatever they plan in today.

### The strictness problem, and the design answer

People put anything in spreadsheets: `3/5/26` and `March 5th`, `Sarah K.` for a member named `Sarah Kowalski`, a `Task` column instead of `Title`, semicolon-delimited CSVs from European Excel, stray blank rows, a `Budget` column we've never heard of. If the importer rejects all of that, it's unusable; if it silently guesses, we ingest garbage and the user doesn't find out until their timeline is wrong.

The resolution is a single principle: **be liberal in what we parse, strict in what we write, and make every liberty visible in between.**

- **Liberal parse:** the parser accepts messy-but-unambiguous input — header synonyms, many date formats, case-insensitive name matches, flexible delimiters, `50%` for progress. It works hard so the user doesn't have to pre-clean the file.
- **Strict write:** nothing coerced ever reaches the database unseen. What gets written is exactly what the preview displayed — normalized dates, resolved IDs, validated fields. A row that can't be made valid is never written.
- **Visible in between:** the preview is not just an error report; it is the *disclosure mechanism for every interpretation the parser made*. "`3/5/26` read as 2026-03-05." "`sarah kowalski` matched member Sarah Kowalski." "Column `Budget` ignored." Tolerance without a preview is silent corruption; a preview without tolerance is a rejection letter. The two together are the sweet spot: the machine guesses, the human ratifies.

Concretely, every parsed **cell** gets one of three outcomes, which roll up to a per-row status:

| Level | Meaning | Effect on commit |
|---|---|---|
| **ok** | Parsed exactly as given | Written |
| **warning** | Parsed with interpretation, or a non-fatal skip (unknown tag, ignored column, defaulted end date) — message says exactly what was done | Written (with the stated interpretation) |
| **error** | Row cannot be made valid (missing title, unparseable date, end before start) | Row excluded from commit |

Errors are always *row-scoped*, never *file-scoped*: 3 bad rows out of 200 means 197 import and 3 are listed with reasons — the user fixes those three in the spreadsheet and re-imports just them, or ignores them. The only file-scoped errors are structural (not a CSV/xlsx, no mappable Title column, over the size/row cap).

### Decisions locked (2026-07-03)

1. **Unknown status / assignee names: warn + skip the association; never auto-create.** Members are accounts and statuses carry color/order semantics copied from a template — creating them from a typo'd cell is worse than dropping the association. The row still imports; the warning says what was dropped. **Tags are the exception:** they're cheap, unstructured labels, so the preview summary offers an explicit **"Create N missing tags"** checkbox (default **off** — warn + skip unless opted in). This resolves ROADMAP open question 1 with the lean intact plus a safe escape hatch.
2. **Additive-only for v1 — no upsert.** Every commit creates new activities; re-running the same file creates duplicates (with "possible duplicate" warnings in preview, see below). Upsert-by-external-id waits for Phase 18's stable external IDs. Resolves ROADMAP open question 2 per the lean.
3. **Stateless two-pass: same endpoint, same payload, `dryRun` flag.** Preview and commit both upload the file with the chosen options (column mapping, date order, tag-create). No server-side upload staging, no temp files, no session state — the commit re-runs the identical parse + validation and then writes inside one transaction. The file is bounded (cap below) so parsing twice is cheap, and the two passes cannot diverge because the inputs are byte-identical.
4. **Commit writes ok + warning rows and skips error rows — no server-side "abort on any error" mode.** The client *is* the choice mechanism: the user sees "42 ready · 5 warnings · 3 errors" and decides whether to commit. An all-or-nothing preference is just the user not clicking Import. (Drops the ROADMAP's "skipping or rejecting per the caller's choice" flag as needless API surface.)
5. **Column mapping is a first-class step, not just header synonyms.** Auto-mapping (exact template headers, then a synonym table, case/whitespace-insensitive) handles the common case; when columns remain unmapped or the user disagrees, the wizard shows a mapping step (file column → draba field or *Ignore*). This is the single biggest usability lever — nobody's existing spreadsheet has our exact headers. The mapping is part of the request payload, so the API stays scriptable.
6. **All dates are calendar dates (all-day), consistent with the app's date model.** Time-of-day in a cell is accepted and discarded with a warning, not an error.

---

## Reused infrastructure (do not rebuild)

| Concern | Existing asset | Notes |
|---|---|---|
| Column vocabulary | `internal/export` `Columns` (Title, Start, End, Description, Status, Assignees, Tags, Parent, Progress, Location, URL) | The import template *is* the export header row — round-trip holds by construction. Import parses the same multi-value `", "` joins export writes. |
| xlsx read/write | `github.com/xuri/excelize/v2` (already a dependency for 14.1) | Read side: first non-empty sheet, typed cells (native Excel dates arrive as serials — read via excelize's typed accessors, no string guessing needed). |
| Name→ID resolution data | Team members / per-timeline statuses / team tags repos (10.x) | Import inverts export's ID→name maps: build name→ID lookups per target timeline. |
| Activity creation + validation | `POST` activity create path, `activity_assignments`, parent linking (Phase 5/11.1.1 semantics) | Import commit calls the same repo-level create used by the API — one write path, one set of invariants, events emitted per created activity (WebSocket consumers update live). |
| Toolbar entry point | Sidebar split-button "Bulk import" stub (`onBulkImport`, Phase 11.1.1) | Becomes the wizard trigger. |
| Dialog/wizard chrome | `ExportDialog` patterns, shadcn Dialog/Table components | Import wizard is a stepped dialog in the same visual family. |

---

## API

### `POST /teams/:id/timelines/:timelineId/import`

Authenticated, team-scoped (same route family as the other team-scoped activity routes — avoids the `/timelines/share/{token}` mux conflict). `multipart/form-data`:

- `file` — the CSV or xlsx upload
- `options` — JSON part:
  ```jsonc
  {
    "dryRun": true,                  // preview pass; false = commit
    "mapping": { "Task": "title", "Begin": "start" /* fileColumn → field | omitted = ignore */ },
                                     // optional; omitted = server auto-mapping
    "dateOrder": "mdy",              // "mdy" | "dmy" — only consulted for ambiguous numeric dates
    "createMissingTags": false
  }
  ```

Response (same shape for both passes; commit adds `created` IDs):

```jsonc
{
  "mapping": { /* the mapping actually used, incl. auto-mapped + ignored columns */ },
  "summary": { "total": 50, "ok": 42, "warnings": 5, "errors": 3, "created": 47 },
  "unknownNames": { "statuses": ["Blocked"], "assignees": ["Sarah K."], "tags": ["q3", "launch"] },
  "rows": [
    {
      "line": 2,                     // 1-based source line / sheet row, for spreadsheet cross-reference
      "status": "warning",           // ok | warning | error
      "activity": { "title": "...", "start": "2026-03-05", "end": "2026-03-07", /* resolved fields */ },
      "issues": [
        { "level": "warning", "field": "start", "message": "\"3/5/26\" read as 2026-03-05 (month-day-year)" },
        { "level": "warning", "field": "assignees", "message": "\"Sarah K.\" doesn't match a team member — skipped" }
      ],
      "createdId": "act_…"           // commit pass only, ok/warning rows
    }
  ]
}
```

- **Dry-run is provably read-only** — the preview pass never opens a write transaction (exit criterion: DB byte-identical after dry-run).
- **Commit is one transaction** over the accepted rows: parents created before children (topological order within the batch), all-or-nothing *within the accepted set* (a constraint failure mid-write rolls back and returns an error — no partial imports).
- File-scoped `400`s: unsupported type, > **2 MB** / > **2,000 rows** (generous for the target market; protects the sync request path), no mappable Title column, xlsx with no non-empty sheet.

### `GET /import/template.csv` and `GET /import/template.xlsx`

Downloadable template: the export header row + two example rows (one minimal — title/start/end only; one full — every column populated, including a multi-assignee cell and a Parent reference to the first row). The xlsx variant formats Start/End as date cells so Excel users stay in native dates. Served from the same `internal/export` column definitions so template and export can't drift.

### OpenAPI

`ImportOptions`, `ImportResult`, `ImportRowResult`, `ImportIssue` schemas; regenerate TS types into `packages/shared`.

---

## Tolerance rules (the parser contract)

Each rule states what's accepted and what the preview says. Everything below the "ok" line produces a visible message.

**Structure**
- CSV delimiter sniffed from the header line: comma, semicolon, tab (European Excel exports semicolons). UTF-8 with or without BOM; a non-UTF-8 file that decodes as cp1252 is accepted with a file-level warning.
- xlsx: first non-empty sheet; others ignored with a warning naming them.
- Fully blank rows skipped silently (not counted). Rows with fewer cells than headers are padded with empties; extra cells → row warning.
- File columns mapped to no field are **ignored with a warning** ("Column `Budget` not imported"), never an error.

**Headers → fields (auto-mapping)**
- Case/whitespace/punctuation-insensitive match against template headers, then a synonym table: Title ← *name, task, activity, event, summary, what*; Start ← *start date, begin, from, date*; End ← *end date, finish, to, due, due date, until*; Description ← *notes, details, desc*; Status ← *state, stage, column*; Assignees ← *assignee, assigned to, owner, who, members, people*; Tags ← *labels, categories*; Parent ← *parent task, parent activity*; Progress ← *% complete, percent, completion*; Location ← *where, place*; URL ← *link, website*.
- A bare `Date` column maps to Start (End defaults per the date rules). Two columns mapping to the same field → file-level error asking for an explicit mapping.

**Dates**
- Accepted, in order: ISO `2026-03-05`; numeric with `/`, `-`, or `.` separators (`3/5/2026`, `05.03.2026`, 2-digit years → 20xx); written months in either order (`March 5, 2026`, `5 Mar 2026`); Excel native date cells (serials via excelize typed read — no string parsing at all).
- **Ambiguity is resolved column-wide, not per-row:** scan all values in the column — if any row's first number exceeds 12, the file is day-first (and vice versa); a consistent interpretation is applied to every row. If the whole file stays ambiguous, `options.dateOrder` decides (UI asks once, defaulting to MDY); every ambiguous cell carries a warning stating the interpretation.
- Time-of-day present → discarded, warning (all dates are calendar dates).
- Missing End → End = Start (single-day), warning. End before Start → **error** (silently swapping dates is a step too magical — this is exactly the "bad data" the preview exists to catch).
- Unparseable date → error with the offending text quoted.

**Names (Status / Assignees / Tags / Parent)**
- Normalization before matching: trim, collapse internal whitespace, casefold.
- Status: normalized exact match against the target timeline's statuses. Unknown → warning, activity imports with no status.
- Assignees: split on `,` or `;`; each token matched against member display name **or email** (email is the unambiguous form — the template's full example shows it). Unknown → warning, that assignee skipped, others kept. Two members normalizing identically → warning, skipped ("ambiguous — use email").
- Tags: split like assignees; unknown → warning + skip, or created when `createMissingTags` (created tags listed in the preview summary before the user opts in — the `unknownNames.tags` list drives the checkbox label).
- Parent: matched by normalized title against **rows earlier in this file first, then existing activities on the target timeline**. Multiple matches → warning, link skipped ("ambiguous parent"). Parent row itself errored → warning, imported without parent. Cycle within the file → warning, link skipped.

**Progress** — integer 0–100, optional `%` suffix, decimals rounded. Out of range or non-numeric → warning, field skipped.

**Duplicates** — a row whose normalized title + start + end exactly matches an existing activity on the target timeline gets a "possible duplicate" **warning** (import remains additive — this is disclosure, not dedup). This is what makes accidental double-imports visible on the second run.

**Required minimum** — a row needs a non-empty Title and a parseable Start (End can default). Everything else can be empty. Missing title → error; whole row of empties → skipped as blank.

---

## Web — the import wizard

Stepped dialog opened from the sidebar's "Bulk import" split-button item (and the empty-timeline state, if trivially wireable).

1. **Upload** — target timeline picker (pre-selected to the active timeline), drag/drop or file picker (`.csv`, `.xlsx`), "Download template" links. On file choose → immediate dry-run POST.
2. **Map columns** — shown **only when** auto-mapping left unmapped file columns or the user clicks "Adjust mapping" (the happy path — our own template or a Phase 14 export — skips straight to preview). Each file column → field dropdown or *Ignore*; date-order question appears here only if the file was ambiguous. Changing anything re-runs the dry-run.
3. **Preview** — summary strip ("42 ready · 5 with warnings · 3 errors — errors won't be imported"), `Create N missing tags` checkbox when applicable (re-runs dry-run on toggle), and the row table: source line number, status icon, resolved title/dates/fields, expandable per-cell messages. Filter chips (All / Warnings / Errors) so a 500-row file with 3 errors is reviewable in seconds.
4. **Commit + result** — "Import 47 activities" button (disabled at 0 importable) → commit POST → result summary (created / skipped counts, link to the timeline) + toast. Created activities appear via the normal event → WebSocket path.

State via a `useImportPreview` / `useCommitImport` hook pair (TanStack mutation on the same endpoint, `dryRun` toggled); invalidate activity queries on commit.

---

## Sub-phases

### 15.1 — Server: parse, validate, preview, commit, template (M, 1.5–2 days)
`internal/importer` package (parser + tolerance rules + resolver), the import endpoint (both passes), template endpoints, OpenAPI + regenerated types. Table-driven Go tests are the bulk of the work: every tolerance rule above gets a fixture (this is where the sweet spot is actually pinned down). Round-trip test: export a seeded timeline via 14.1 → re-import → same activities modulo IDs. Dry-run leaves the DB byte-identical.

### 15.2 — Web: wizard (M, 1–1.5 days)
Wizard dialog (4 steps, conditional mapping step), hooks, wiring the sidebar stub. Component tests: step flow, mapping override re-runs preview, error rows excluded from the commit count, tag-checkbox re-run. Incremental live testing against the real API per working agreement (upload a deliberately messy CSV early, not at the end).

### 15.3 — Hardening + e2e (S, 0.5 day)
Messy-file corpus e2e (European CSV, Excel dates, mixed formats, dupes, unknown names, 1,000-row file), `/test-phase`-style verification against Docker, TESTING.md assertions for Phase 15 (start paying down the missing-sections debt with this phase rather than adding to it), dedicated `mapping.go` test fixtures (duplicate targets, unknown columns — indirect-only coverage flagged by /review-phase 15.1), log + session-state updates.

---

## Cut from scope (v1)

- **Upsert / re-import reconciliation** — additive only; Phase 18 external IDs unlock upsert.
- **Auto-create statuses or members** — warn + skip permanently for members; statuses revisit on demand.
- **Async/job-based import** — sync request path; the 2,000-row cap keeps it well-bounded. Revisit only with evidence.
- **Google Sheets URL import** — belongs with the connectors phase; xlsx covers "I have it in Sheets" via download.
- **Server-side stored upload between preview and commit** — stateless two-pass instead (decision 3).
- **Import of anything but activities** — no member/status/timeline bulk import.
- **SMTP dependency** — the old TASKS.md note tied SMTP to "import errors emails"; this design is interactive (errors surface in the preview, not email), so SMTP/password-reset is fully decoupled from Phase 15 and re-parked.

---

## Exit criteria — safe to pause when

- Downloading the template, filling it in, and re-uploading creates the expected activities on the target timeline
- A Phase 14 CSV **and xlsx** export re-imported reproduces the same activities (modulo server-assigned IDs), with duplicate warnings on a second run
- Dry-run returns per-row ok/warning/error and leaves the database byte-identical
- A file with `Task`/`Begin`/`Finish` headers auto-maps; an unmappable column can be assigned in the wizard; ignored columns are disclosed
- `3/5/26`, `05.03.2026`, `March 5, 2026`, and native Excel date cells all land on the correct calendar dates, with ambiguous formats disclosed as warnings
- Invalid rows (missing title, end-before-start, unparseable date) are flagged in preview and excluded from commit; valid rows in the same file still import
- Unknown status/assignee names warn and skip the association without aborting; unknown tags are created only when the checkbox is opted into
- `golangci-lint run` clean; `go test ./...` passes; `pnpm --filter web lint` clean; `pnpm --filter web test` passes
