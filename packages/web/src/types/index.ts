/**
 * Local UI types and design-token palettes.
 *
 * These are placeholders used while the frontend is built against mocks.
 * Once the API client is wired up, the wire-format types will come from
 * the generated definitions in `packages/shared/` (see web/CLAUDE.md);
 * the view-only fields (e.g. `startCol`, `span`) will stay here.
 */

/** Lifecycle of a single event on the timeline. */
export type EventStatus = 'planned' | 'in-progress' | 'done';

/** A person who can be assigned to events on a timeline. */
export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

/**
 * A scheduled chunk of work shown as a block on the timeline.
 *
 * `startCol` and `span` are derived view-state, not stored on the server —
 * they're recomputed by the parent whenever the visible date range changes.
 */
export interface DrabaEvent {
  id: string;
  title: string;
  memberId: string;
  /** ISO date string, e.g. "2026-04-28" */
  startDate: string;
  /** ISO date string, e.g. "2026-05-05" */
  endDate: string;
  /** Column index within the visible date range — computed by the parent */
  startCol: number;
  /** Number of columns this event spans — computed by the parent */
  span: number;
  color: string;
  status: EventStatus;
  notes?: string;
}

/** Member-avatar palette — references CSS custom properties from index.css. */
export const MEMBER_COLORS: string[] = [
  'var(--member-1-teal)',
  'var(--member-2-amber)',
  'var(--member-3-sky)',
  'var(--member-4-emerald)',
  'var(--member-5-violet)',
  'var(--member-6-rose)',
  'var(--member-7-indigo)',
  'var(--member-8-lime)',
];

/**
 * Event-block palette. Inlined as hex (not CSS vars) because event colors
 * are persisted with the event and travel through the API; a stable literal
 * survives theme changes and DB inspection.
 */
export const EVENT_COLORS: string[] = [
  '#288C9B',
  '#F29E4C',
  '#9B59B6',
  '#2ECC71',
  '#5C6BC0',
  '#E74C3C',
  '#5BC0DE',
  '#8BC34A',
];

/** Human-readable label for each EventStatus. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  'planned':     'Planned',
  'in-progress': 'In progress',
  'done':        'Done',
};
