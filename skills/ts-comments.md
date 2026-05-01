# TypeScript / React Comment Conventions

Apply this whenever generating, editing, or reviewing TypeScript, TSX,
or JavaScript code in `packages/web/` (and any future TS packages).
Run `pnpm --filter web lint` and `pnpm --filter web build` before committing.

The philosophy is the same as for Go: **comment the *why*, not the *what*.**
Well-named identifiers and a glance at the signature already tell the reader
*what*. Comments earn their place by explaining intent, constraints,
trade-offs, and surprises.

## The rules

### 1. File-level header — only when it adds orientation

A short JSDoc at the top of a non-trivial file helps a reader who has just
opened it. Skip it for tiny components (one-liner avatars, app entry points,
config files). Use it when the file owns a meaningful pattern, has a
non-obvious editing/lifecycle model, or coordinates multiple concerns.

```tsx
/**
 * Right-side detail panel for a selected timeline event.
 *
 * Editing model:
 *  - `title` and `notes` use local state and commit on blur, so we don't
 *    fire an `onChange` for every keystroke.
 *  - `status` and `color` commit immediately (single discrete choice).
 */
export default function EventPanel(...) { ... }
```

A "header" can live on the default-exported component itself rather than
above the imports — wherever it reads most naturally for that file.

### 2. Exported types, interfaces, components, and functions — TSDoc

Use `/** ... */` (TSDoc/JSDoc) on every exported declaration that isn't
trivially obvious from its name and shape. Editors surface these on hover
and in autocomplete, which is the main payoff.

```ts
/** Lifecycle of a single event on the timeline. */
export type EventStatus = 'planned' | 'in-progress' | 'done';

/**
 * A scheduled chunk of work shown as a block on the timeline.
 *
 * `startCol` and `span` are derived view-state, not stored on the server —
 * they're recomputed by the parent whenever the visible date range changes.
 */
export interface DrabaEvent { ... }
```

For interface fields, prefer per-field TSDoc (`/** ... */`) over trailing
`// ...` so the doc shows up in editor hover-cards.

Skip the doc when the name fully says it: `interface Props { ... }`,
`function IconBtn(...)`, a one-line `Member` interface — let the code speak.

### 3. Components — what to put in the doc

Aim for a 1–4 line summary that covers any of:
- What the component is *for* (one sentence).
- Who owns its state (the component, the parent, a context).
- The editing/commit model if non-obvious (debounce, on-blur, optimistic).
- Required parents / context providers.

Don't list every prop — the `Props` interface already does that.

### 4. Inline comments — only for the WHY

Reserve inline `//` comments for:

- **Magic numbers and tuning constants.** State the reasoning, not the value.
  ```ts
  // Tuned by eye: 38% of diameter keeps two-letter initials inside the
  // circle at every size we use (22–32px) without per-size overrides.
  const fontSize = Math.round(size * 0.38);
  ```
- **Non-obvious effect dependencies / lifecycle behaviour.**
  ```ts
  // Reset local edits when the panel switches to a different event.
  useEffect(() => { ... }, [event.id]);
  ```
- **Hidden coupling** (e.g. "stays in sync with `--col-width` in index.css").
- **Workarounds** for a specific browser bug or library quirk — link the issue.
- **Placeholder code** that will be replaced when an integration lands
  (`// Placeholder timelines — replaced when API layer is wired`).

Do not narrate the code, restate the prop name, or comment "for clarity".
If removing the comment wouldn't confuse a future reader, don't write it.

### 5. `any`, `as`, `@ts-expect-error` — comment is required

Per `docs/CONVENTIONS.md`:
- Every `any` needs a `// reason:` comment explaining why a precise type
  isn't possible.
- Every type assertion (`x as Y`) needs a comment explaining why the cast
  is sound.
- Every `@ts-expect-error` / `@ts-ignore` needs a comment with the
  underlying issue and a removal trigger.

```ts
// reason: third-party lib emits an untyped event payload; shape is checked at runtime in handleEvent
const data: any = ev.detail;
```

### 6. JSX section comments — light touch

Short `{/* Header */}` / `{/* Body */}` markers are fine for long render
trees (TopBar, Sidebar, EventPanel). Don't put logic explanations inside
JSX — extract to a variable or sub-component instead.

### 7. Style mechanics

- TSDoc uses `/** ... */`, terminated on its own `*/` line for multi-line.
- Wrap at ~90 cols. Use complete sentences with a period.
- Refer to other identifiers in backticks (`` `useEffect` ``, `` `Props` ``).
- Mark deprecations with `@deprecated`; editors render this with a strikethrough.
  ```ts
  /** @deprecated use {@link NewThing} instead. */
  ```
- Use `@param` / `@returns` only when they add detail beyond the type
  signature — otherwise they're just noise that goes stale.

### 8. What NOT to comment

- Re-stating the signature (`/** Takes a string and returns a number. */`).
- Explaining standard React patterns (`// useState for the title`).
- Listing imports or what a file imports.
- Change-log style comments (`// added in PR #123`, `// new in v2`) —
  that's git's job.
- TODOs without an owner and a concrete trigger condition.
- File-level headers that just paraphrase the export name.

## Checklist before committing TS/React code

- [ ] Each non-trivial file has a one-paragraph header *or* a TSDoc on its
      default export — whichever orients a cold reader faster.
- [ ] Every exported type, interface, component, and function has a TSDoc
      unless its name plus signature is fully self-explanatory.
- [ ] Inline comments explain *why*, not *what*; none restate the code
      or describe standard React idioms.
- [ ] Every `any`, `as`, and `@ts-expect-error` carries the required
      reason comment per `docs/CONVENTIONS.md`.
- [ ] No stale comments referring to removed code, prior implementations,
      or the task that produced the change.
- [ ] `pnpm --filter web lint` and `pnpm --filter web build` pass.
