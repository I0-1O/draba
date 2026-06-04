/**
 * Unit tests for kanbanColumns pure logic.
 * Mirrors the pattern used by calendarLanes.test.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  buildColumns,
  sortActivities,
  buildHierarchyMaps,
  toggleCollapsedColumn,
  NO_STATUS_ID,
  UNASSIGNED_ID,
  type KanbanGroupBy,
} from './kanbanColumns';
import type { components } from '@draba/shared';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ApiActivity> & { id: string }): ApiActivity {
  return {
    id: overrides.id,
    title: overrides.title ?? `Activity ${overrides.id}`,
    timelineId: 'tl1',
    startAt: overrides.startAt ?? '2026-01-01T00:00:00Z',
    endAt: overrides.endAt ?? '2026-01-07T00:00:00Z',
    color: overrides.color ?? '#288C9B',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
    assignedMemberIds: overrides.assignedMemberIds ?? [],
    tagIds: overrides.tagIds ?? [],
    percentComplete: overrides.percentComplete ?? null,
    archivedAt: null,
    description: overrides.description ?? null,
    icon: overrides.icon ?? null,
    location: overrides.location ?? null,
    notes: overrides.notes ?? null,
    statusId: overrides.statusId ?? null,
    parentActivityId: overrides.parentActivityId ?? null,
    url: overrides.url ?? null,
  } as ApiActivity;
}

function makeStatus(id: string, name: string, position: number, color = '#288C9B'): Status {
  return { id, name, position, color, icon: null, isClosed: false, timelineId: 'tl1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as Status;
}

function makeMember(id: string, displayName: string): TeamMemberWithUser {
  return { id, displayName, email: `${id}@test.com`, role: 'member', userId: id, color: null, icon: null, archivedAt: null, joinedAt: '2026-01-01T00:00:00Z', teamId: 'team1' } as unknown as TeamMemberWithUser;
}

const statuses = [
  makeStatus('s1', 'Planned', 0, '#888'),
  makeStatus('s2', 'In Progress', 1, '#1A97A2'),
  makeStatus('s3', 'Done', 2, '#22c55e'),
];

const members = [
  makeMember('m1', 'Alice'),
  makeMember('m2', 'Bob'),
  makeMember('m3', 'Carol'),
];

// ── sortActivities ─────────────────────────────────────────────────────────────

describe('sortActivities', () => {
  it('sorts by startDate ascending', () => {
    const acts = [
      makeActivity({ id: 'c', startAt: '2026-03-01T00:00:00Z' }),
      makeActivity({ id: 'a', startAt: '2026-01-01T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-02-01T00:00:00Z' }),
    ];
    const result = sortActivities(acts, 'startDate');
    expect(result.map(a => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by title A-Z', () => {
    const acts = [
      makeActivity({ id: '1', title: 'Zebra' }),
      makeActivity({ id: '2', title: 'Alpha' }),
      makeActivity({ id: '3', title: 'Mango' }),
    ];
    const result = sortActivities(acts, 'title');
    expect(result.map(a => a.title)).toEqual(['Alpha', 'Mango', 'Zebra']);
  });

  it('sorts percentComplete descending, nulls last', () => {
    const acts = [
      makeActivity({ id: 'a', percentComplete: 50 }),
      makeActivity({ id: 'b', percentComplete: null }),
      makeActivity({ id: 'c', percentComplete: 100 }),
    ];
    const result = sortActivities(acts, 'percentComplete');
    expect(result.map(a => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts updatedAt descending (most recent first)', () => {
    const acts = [
      makeActivity({ id: 'old', updatedAt: '2026-01-01T00:00:00Z' }),
      makeActivity({ id: 'new', updatedAt: '2026-06-01T00:00:00Z' }),
    ];
    const result = sortActivities(acts, 'updatedAt');
    expect(result[0].id).toBe('new');
  });
});

// ── buildColumns — status ──────────────────────────────────────────────────────

describe('buildColumns: status', () => {
  it('creates No-status column plus one column per status in position order', () => {
    const acts = [makeActivity({ id: 'a1', statusId: 's1' })];
    const cols = buildColumns('status', acts, [], statuses, 'startDate');
    expect(cols[0].id).toBe(NO_STATUS_ID);
    expect(cols[0].label).toBe('No status');
    expect(cols.slice(1).map(c => c.id)).toEqual(['s1', 's2', 's3']);
  });

  it('routes activities to the correct status column', () => {
    const acts = [
      makeActivity({ id: 'a1', statusId: 's2' }),
      makeActivity({ id: 'a2', statusId: null }),
      makeActivity({ id: 'a3', statusId: 's1' }),
    ];
    const cols = buildColumns('status', acts, [], statuses, 'startDate');
    expect(cols.find(c => c.id === NO_STATUS_ID)!.items.map(a => a.id)).toEqual(['a2']);
    expect(cols.find(c => c.id === 's1')!.items.map(a => a.id)).toEqual(['a3']);
    expect(cols.find(c => c.id === 's2')!.items.map(a => a.id)).toEqual(['a1']);
  });

  it('status columns are droppable; no-status column is droppable with null statusId', () => {
    const cols = buildColumns('status', [], [], statuses, 'startDate');
    const noStatus = cols.find(c => c.id === NO_STATUS_ID)!;
    expect(noStatus.droppable).toBe(true);
    expect(noStatus.dropValue).toEqual({ statusId: null });
    const s1 = cols.find(c => c.id === 's1')!;
    expect(s1.droppable).toBe(true);
    expect(s1.dropValue).toEqual({ statusId: 's1' });
  });

  it('handles unknown statusId gracefully (routes to no-status)', () => {
    const acts = [makeActivity({ id: 'x', statusId: 'deleted-status' })];
    const cols = buildColumns('status', acts, [], statuses, 'startDate');
    expect(cols.find(c => c.id === NO_STATUS_ID)!.items.map(a => a.id)).toEqual(['x']);
  });
});

// ── buildColumns — member ──────────────────────────────────────────────────────

describe('buildColumns: member', () => {
  it('creates Unassigned column first, then one column per member', () => {
    const cols = buildColumns('member', [], members, [], 'startDate');
    expect(cols[0].id).toBe(UNASSIGNED_ID);
    expect(cols.slice(1).map(c => c.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('routes activity to primary (first) member column', () => {
    const acts = [makeActivity({ id: 'a', assignedMemberIds: ['m2', 'm1'] })];
    const cols = buildColumns('member', acts, members, [], 'startDate');
    expect(cols.find(c => c.id === 'm2')!.items.map(a => a.id)).toEqual(['a']);
    expect(cols.find(c => c.id === 'm1')!.items).toHaveLength(0);
  });

  it('routes unassigned activity to Unassigned column', () => {
    const acts = [makeActivity({ id: 'u', assignedMemberIds: [] })];
    const cols = buildColumns('member', acts, members, [], 'startDate');
    expect(cols.find(c => c.id === UNASSIGNED_ID)!.items.map(a => a.id)).toEqual(['u']);
  });

  it('dropValue for member column sets assignedMemberIds to singleton', () => {
    const cols = buildColumns('member', [], members, [], 'startDate');
    const m1col = cols.find(c => c.id === 'm1')!;
    expect(m1col.dropValue).toEqual({ assignedMemberIds: ['m1'] });
  });

  it('dropValue for Unassigned column sets assignedMemberIds to empty', () => {
    const cols = buildColumns('member', [], members, [], 'startDate');
    const unassigned = cols.find(c => c.id === UNASSIGNED_ID)!;
    expect(unassigned.dropValue).toEqual({ assignedMemberIds: [] });
  });
});

// ── buildColumns — member-combination ─────────────────────────────────────────

describe('buildColumns: member-combination', () => {
  it('groups by exact assignee set, not primary member', () => {
    const acts = [
      makeActivity({ id: 'solo-alice', assignedMemberIds: ['m1'] }),
      makeActivity({ id: 'alice-bob', assignedMemberIds: ['m1', 'm2'] }),
      makeActivity({ id: 'solo-alice-2', assignedMemberIds: ['m1'] }),
    ];
    const cols = buildColumns('member-combination', acts, members, [], 'startDate');
    const aliceCol = cols.find(c => c.label === 'Alice')!;
    expect(aliceCol.items).toHaveLength(2);
    const combCol = cols.find(c => c.label === 'Alice and Bob')!;
    expect(combCol.items).toHaveLength(1);
  });

  it('combination columns are non-droppable', () => {
    const acts = [makeActivity({ id: 'a', assignedMemberIds: ['m1', 'm2'] })];
    const cols = buildColumns('member-combination', acts, members, [], 'startDate');
    expect(cols.every(c => !c.droppable)).toBe(true);
  });

  it('empty assignee set maps to Unassigned column', () => {
    const acts = [makeActivity({ id: 'u', assignedMemberIds: [] })];
    const cols = buildColumns('member-combination', acts, members, [], 'startDate');
    const unassigned = cols.find(c => c.label === 'Unassigned');
    expect(unassigned).toBeDefined();
    expect(unassigned!.items).toHaveLength(1);
  });
});

// ── empty activities ───────────────────────────────────────────────────────────

describe('buildColumns with no activities', () => {
  const emptyActs: ApiActivity[] = [];

  (['status', 'member', 'member-combination'] as KanbanGroupBy[]).forEach(mode => {
    it(`${mode} groupBy produces columns without throwing`, () => {
      expect(() =>
        buildColumns(mode, emptyActs, members, statuses, 'startDate'),
      ).not.toThrow();
    });
  });
});

// ── buildHierarchyMaps ─────────────────────────────────────────────────────────

describe('buildHierarchyMaps', () => {
  it('returns empty maps when there are no parent-child relationships', () => {
    const acts = [
      makeActivity({ id: 'a' }),
      makeActivity({ id: 'b' }),
    ];
    const { childrenByParentId, childIds } = buildHierarchyMaps(acts);
    expect(childrenByParentId.size).toBe(0);
    expect(childIds.size).toBe(0);
  });

  it('maps children to their parent', () => {
    const acts = [
      makeActivity({ id: 'parent' }),
      makeActivity({ id: 'child1', parentActivityId: 'parent' }),
      makeActivity({ id: 'child2', parentActivityId: 'parent' }),
    ];
    const { childrenByParentId, childIds } = buildHierarchyMaps(acts);
    expect(childrenByParentId.get('parent')?.map(a => a.id)).toEqual(['child1', 'child2']);
    expect(childIds).toEqual(new Set(['child1', 'child2']));
  });

  it('orphaned child (parent filtered out) is not placed in childrenByParentId', () => {
    // Only the child is in the visible set; parent is absent (filtered).
    const acts = [makeActivity({ id: 'child', parentActivityId: 'absent-parent' })];
    const { childrenByParentId, childIds } = buildHierarchyMaps(acts);
    expect(childrenByParentId.size).toBe(0);
    // The child is NOT in childIds, so it surfaces as a root card.
    expect(childIds.has('child')).toBe(false);
  });

  it('supports multi-level nesting', () => {
    const acts = [
      makeActivity({ id: 'root' }),
      makeActivity({ id: 'mid', parentActivityId: 'root' }),
      makeActivity({ id: 'leaf', parentActivityId: 'mid' }),
    ];
    const { childrenByParentId, childIds } = buildHierarchyMaps(acts);
    expect(childrenByParentId.get('root')?.map(a => a.id)).toEqual(['mid']);
    expect(childrenByParentId.get('mid')?.map(a => a.id)).toEqual(['leaf']);
    expect(childIds).toEqual(new Set(['mid', 'leaf']));
  });
});

// ── toggleCollapsedColumn ─────────────────────────────────────────────────────

describe('toggleCollapsedColumn', () => {
  it('adds a column ID when it is not yet collapsed', () => {
    expect(toggleCollapsedColumn([], 'col-1')).toEqual(['col-1']);
    expect(toggleCollapsedColumn(['col-2'], 'col-1')).toEqual(['col-2', 'col-1']);
  });

  it('removes a column ID when it is already collapsed', () => {
    expect(toggleCollapsedColumn(['col-1'], 'col-1')).toEqual([]);
    expect(toggleCollapsedColumn(['col-1', 'col-2'], 'col-1')).toEqual(['col-2']);
  });

  it('does not mutate the input array', () => {
    const original = ['col-1'];
    toggleCollapsedColumn(original, 'col-2');
    expect(original).toEqual(['col-1']);
  });
});

// ── handleAddInColumn prefill ─────────────────────────────────────────────────

describe('column dropValue encodes correct prefill context', () => {
  it('status column dropValue carries statusId for create prefill', () => {
    const cols = buildColumns('status', [], [], statuses, 'startDate');
    const s1 = cols.find(c => c.id === 's1')!;
    // dropValue.statusId is what handleAddInColumn passes as the default statusId.
    expect(s1.dropValue?.statusId).toBe('s1');
    expect('statusId' in (s1.dropValue ?? {})).toBe(true);
  });

  it('no-status column dropValue has statusId: null', () => {
    const cols = buildColumns('status', [], [], statuses, 'startDate');
    const noStatus = cols.find(c => c.id === NO_STATUS_ID)!;
    expect(noStatus.dropValue?.statusId).toBeNull();
    expect('statusId' in (noStatus.dropValue ?? {})).toBe(true);
  });

  it('member column dropValue carries assignedMemberIds singleton', () => {
    const cols = buildColumns('member', [], members, [], 'startDate');
    const m1 = cols.find(c => c.id === 'm1')!;
    expect(m1.dropValue?.assignedMemberIds).toEqual(['m1']);
  });

  it('unassigned column dropValue has empty assignedMemberIds and no statusId key', () => {
    const cols = buildColumns('member', [], members, [], 'startDate');
    const unassigned = cols.find(c => c.id === UNASSIGNED_ID)!;
    expect(unassigned.dropValue?.assignedMemberIds).toEqual([]);
    expect('statusId' in (unassigned.dropValue ?? {})).toBe(false);
  });
});
