export type EventStatus = 'planned' | 'in-progress' | 'done';

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

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

export const STATUS_LABELS: Record<EventStatus, string> = {
  'planned':     'Planned',
  'in-progress': 'In progress',
  'done':        'Done',
};
