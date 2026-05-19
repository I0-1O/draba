/**
 * Local UI types and design-token palettes.
 *
 * Wire-format API types come from generated definitions in `packages/shared/`.
 * Only view-state types (computed from API data) live here.
 */

/** A person who can be assigned to events on a timeline. */
export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
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

// ── Legacy types — kept for EventPanel until Phase 8.2 rewrites it ──────────

/** @deprecated Phase 8.2 will replace this with the API Event type. */
export type EventStatus = 'planned' | 'in-progress' | 'done';

/** @deprecated Phase 8.2 will replace this with the API Event type. */
export interface DrabaEvent {
  id: string;
  title: string;
  memberId: string;
  startDate: string;
  endDate: string;
  startCol: number;
  span: number;
  color: string;
  status: EventStatus;
  notes?: string;
}

/** @deprecated Phase 8.2 will replace this with resolved team_statuses labels. */
export const STATUS_LABELS: Record<EventStatus, string> = {
  'planned':     'Planned',
  'in-progress': 'In progress',
  'done':        'Done',
};
