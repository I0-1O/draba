/**
 * Local UI types and design-token palettes.
 *
 * Wire-format API types come from generated definitions in `packages/shared/`.
 * Only view-state types (computed from API data) live here.
 *
 * ACTIVITY_COLORS and MEMBER_COLORS are now re-exported from identity-constants
 * so there is a single source of truth for the 16-color palette.
 */

export { ACTIVITY_COLORS, MEMBER_COLORS } from '@/components/identity/identity-constants';

/** A person who can be assigned to events on a timeline. */
export interface Member {
  id: string;
  name: string;
  initials: string;
  /** Hex color for display (e.g. '#288C9B'). Falls back to palette slot when not set. */
  color: string;
}

// ── Legacy types — kept for ActivityPanel until Phase 8.2 rewrites it ──────────

/** @deprecated Phase 8.2 will replace this with the API Activity type. */
export type ActivityStatus = 'planned' | 'in-progress' | 'done';

/** @deprecated Phase 8.2 will replace this with the API Activity type. */
export interface DrabaActivity {
  id: string;
  title: string;
  memberId: string;
  startDate: string;
  endDate: string;
  startCol: number;
  span: number;
  color: string;
  status: ActivityStatus;
  notes?: string;
}

/** @deprecated Phase 8.2 will replace this with resolved team_statuses labels. */
export const STATUS_LABELS: Record<ActivityStatus, string> = {
  'planned':     'Planned',
  'in-progress': 'In progress',
  'done':        'Done',
};
