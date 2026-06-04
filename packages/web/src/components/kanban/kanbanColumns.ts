/**
 * kanbanColumns — pure column-building and sort logic for the Kanban view.
 *
 * Given a groupBy mode plus the visible activities, team members, and timeline
 * statuses, produces an ordered list of KanbanColumn objects ready for rendering.
 * All grouping/labeling/ordering lives here; the React components stay thin.
 */

import type { components } from '@draba/shared';
import {
  memberComboKey,
  orderedComboIds,
  memberComboLabel,
  comboSortComparator,
  UNASSIGNED_KEY,
} from '@/lib/memberGroups';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

// ── Public types ───────────────────────────────────────────────────────────────

export type KanbanGroupBy =
  | 'status'
  | 'member'
  | 'member-combination';

export type KanbanSortBy =
  | 'startDate'
  | 'endDate'
  | 'title'
  | 'percentComplete'
  | 'updatedAt';

export type KanbanCardField =
  | 'dateRange'
  | 'status'
  | 'tags'
  | 'members'
  | 'percentComplete'
  | 'parent'
  | 'description';

export const DEFAULT_CARD_FIELDS: KanbanCardField[] = [
  'dateRange',
  'status',
  'tags',
  'members',
];

/** Sentinel IDs for "bucket with no value" columns. */
export const NO_STATUS_ID  = '__no-status__';
export const UNASSIGNED_ID = '__unassigned__';

/**
 * A resolved column, ready for rendering.
 *
 * `droppable: false` for combination and None groupings (drop semantics are
 * ambiguous or undefined). `dropValue` encodes what patch to apply on drop.
 */
export interface KanbanColumn {
  id: string;
  label: string;
  /** Hex color for the column accent (header dot, drop-highlight tint). */
  color?: string;
  icon?: string;
  droppable: boolean;
  /** The patch values to apply when a card is dropped into this column. */
  dropValue?: {
    statusId?: string | null;
    assignedMemberIds?: string[];
    parentActivityId?: string | null;
  };
  items: ApiActivity[];
}

// ── Sort comparators ───────────────────────────────────────────────────────────

function cmp<T>(a: T, b: T, dir: 1 | -1 = 1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;  // nulls last
  if (b == null) return -1;
  return a < b ? -dir : a > b ? dir : 0;
}

/** Sort activities within a column according to the chosen sort mode. */
export function sortActivities(
  activities: ApiActivity[],
  sortBy: KanbanSortBy,
): ApiActivity[] {
  const sorted = [...activities];
  switch (sortBy) {
    case 'startDate':
      // cmp with string comparison; null/undefined treated as nulls-last
      sorted.sort((a, b) => {
        const av = a.startAt ?? null;
        const bv = b.startAt ?? null;
        return cmp(av, bv);
      });
      break;
    case 'endDate':
      sorted.sort((a, b) => {
        const av = a.endAt ?? null;
        const bv = b.endAt ?? null;
        return cmp(av, bv);
      });
      break;
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'percentComplete':
      // Descending: highest first, nulls last.
      sorted.sort((a, b) => {
        const av = a.percentComplete ?? null;
        const bv = b.percentComplete ?? null;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return bv - av;
      });
      break;
    case 'updatedAt':
      // Most-recently-updated first
      sorted.sort((a, b) => cmp(b.updatedAt, a.updatedAt));
      break;
  }
  return sorted;
}

// ── Hierarchy helpers ─────────────────────────────────────────────────────────

/**
 * Compute parent→children and child-id maps for the hierarchy display mode.
 *
 * Only considers children whose parent is also present in `activities` — an
 * orphaned child (parent filtered out) stays visible as a root card.
 */
export function buildHierarchyMaps(
  activities: ApiActivity[],
): { childrenByParentId: Map<string, ApiActivity[]>; childIds: Set<string> } {
  const visibleIds = new Set(activities.map(a => a.id));
  const childrenByParentId = new Map<string, ApiActivity[]>();
  for (const act of activities) {
    const pid = (act as ApiActivity & { parentActivityId?: string | null }).parentActivityId ?? null;
    if (pid && visibleIds.has(pid)) {
      if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
      childrenByParentId.get(pid)!.push(act);
    }
  }
  const childIds = new Set<string>();
  childrenByParentId.forEach(children => children.forEach(c => childIds.add(c.id)));
  return { childrenByParentId, childIds };
}

/**
 * Toggle a column ID in/out of the collapsed set.
 * Returns a new array — does not mutate the input.
 */
export function toggleCollapsedColumn(collapsedIds: string[], columnId: string): string[] {
  return collapsedIds.includes(columnId)
    ? collapsedIds.filter(id => id !== columnId)
    : [...collapsedIds, columnId];
}

// ── buildColumns ──────────────────────────────────────────────────────────────

/**
 * Build the ordered column list from the active groupBy, activities, members,
 * and statuses. Applies `sortBy` within each column.
 */
export function buildColumns(
  groupBy: KanbanGroupBy,
  activities: ApiActivity[],
  members: TeamMemberWithUser[],
  statuses: Status[],
  sortBy: KanbanSortBy,
): KanbanColumn[] {
  switch (groupBy) {
    case 'status':             return buildStatusColumns(activities, statuses, sortBy);
    case 'member':             return buildMemberColumns(activities, members, sortBy);
    case 'member-combination': return buildCombinationColumns(activities, members, sortBy);
  }
}

// ── Status columns ─────────────────────────────────────────────────────────────

function buildStatusColumns(
  activities: ApiActivity[],
  statuses: Status[],
  sortBy: KanbanSortBy,
): KanbanColumn[] {
  // Bucket activities by statusId (null → no-status bucket).
  const byStatus = new Map<string | null, ApiActivity[]>();
  byStatus.set(null, []);
  for (const s of statuses) byStatus.set(s.id, []);
  for (const act of activities) {
    const key = (act as ApiActivity & { statusId?: string | null }).statusId ?? null;
    const bucket = byStatus.get(key) ?? byStatus.get(null)!;
    bucket.push(act);
  }

  // "No status" column first, then statuses in position order.
  const noStatusItems = sortActivities(byStatus.get(null) ?? [], sortBy);
  const statusCols: KanbanColumn[] = statuses
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(s => ({
      id: s.id,
      label: s.name,
      color: s.color ?? undefined,
      icon: s.icon ?? undefined,
      droppable: true,
      dropValue: { statusId: s.id },
      items: sortActivities(byStatus.get(s.id) ?? [], sortBy),
    }));

  return [
    {
      id: NO_STATUS_ID,
      label: 'No status',
      droppable: true,
      dropValue: { statusId: null },
      items: noStatusItems,
    },
    ...statusCols,
  ];
}

// ── Member columns ─────────────────────────────────────────────────────────────

function buildMemberColumns(
  activities: ApiActivity[],
  members: TeamMemberWithUser[],
  sortBy: KanbanSortBy,
): KanbanColumn[] {
  // Assign each activity to its first (primary) member; multi-member cards
  // appear only once in the primary member's column. Unassigned → UNASSIGNED_ID.
  const byMember = new Map<string, ApiActivity[]>();
  byMember.set(UNASSIGNED_ID, []);
  for (const m of members) byMember.set(m.id, []);
  for (const act of activities) {
    const ids = act.assignedMemberIds ?? [];
    const key = ids.length > 0 ? ids[0] : UNASSIGNED_ID;
    const bucket = byMember.get(key) ?? byMember.get(UNASSIGNED_ID)!;
    bucket.push(act);
  }

  const memberCols: KanbanColumn[] = members.map(m => ({
    id: m.id,
    label: m.displayName || m.email || 'Unknown',
    color: m.color ?? undefined,
    droppable: true,
    dropValue: { assignedMemberIds: [m.id] },
    items: sortActivities(byMember.get(m.id) ?? [], sortBy),
  }));

  return [
    {
      id: UNASSIGNED_ID,
      label: 'Unassigned',
      droppable: true,
      dropValue: { assignedMemberIds: [] },
      items: sortActivities(byMember.get(UNASSIGNED_ID) ?? [], sortBy),
    },
    ...memberCols,
  ];
}

// ── Combination columns ────────────────────────────────────────────────────────

function buildCombinationColumns(
  activities: ApiActivity[],
  members: TeamMemberWithUser[],
  sortBy: KanbanSortBy,
): KanbanColumn[] {
  const memberOrder = members.map(m => m.id);
  const nameById = new Map(members.map(m => [m.id, m.displayName || m.email || 'Unknown']));

  const byCombo = new Map<string, ApiActivity[]>();
  for (const act of activities) {
    const key = memberComboKey(act.assignedMemberIds ?? []);
    if (!byCombo.has(key)) byCombo.set(key, []);
    byCombo.get(key)!.push(act);
  }

  const comparator = comboSortComparator(memberOrder);
  const sortedKeys = [...byCombo.keys()].sort(comparator);

  return sortedKeys.map(key => {
    const orderedIds = key === UNASSIGNED_KEY
      ? []
      : orderedComboIds(key.split('|'), memberOrder);
    const label = key === UNASSIGNED_KEY
      ? 'Unassigned'
      : memberComboLabel(orderedIds, nameById);
    return {
      id: key,
      label,
      // Combination columns are non-droppable.
      droppable: false,
      items: sortActivities(byCombo.get(key) ?? [], sortBy),
    };
  });
}

