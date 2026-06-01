/**
 * buildListRows — group-by and tree-nesting behaviour.
 *
 * Mirrors the pattern in GanttView.tree.test.ts: pure logic tests on the
 * exported buildListRows function, no React rendering or hook mocks required.
 */

import { describe, it, expect } from 'vitest'
import { buildListRows } from './ListView'
import type { ListDisplayRow } from './ListView'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']
type Status = components['schemas']['Status']

const NONE = new Set<string>()

function act(
  id: string,
  opts: {
    parentActivityId?: string | null
    assignedMemberIds?: string[]
    statusId?: string | null
  } = {},
): ApiActivity {
  return {
    id,
    title: id,
    timelineId: 'tl1',
    startAt: '2026-01-01T00:00:00Z',
    endAt: '2026-01-02T00:00:00Z',
    allDay: false,
    createdBy: 'user1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    description: null,
    notes: null,
    icon: null,
    color: null,
    percentComplete: null,
    location: null,
    url: null,
    archivedAt: null,
    parentActivityId: opts.parentActivityId ?? null,
    assignedMemberIds: opts.assignedMemberIds ?? [],
    tagIds: [],
    statusId: opts.statusId ?? null,
  }
}

function status(id: string, name: string): Status {
  return { id, name, color: '#000', timelineId: 'tl1', isClosed: false, position: 0, createdAt: '', updatedAt: '' }
}

function actRows(rows: ListDisplayRow[]) {
  return rows
    .filter((r): r is Extract<ListDisplayRow, { kind: 'activity' }> => r.kind === 'activity')
    .map(r => ({ id: r.activity.id, depth: r.depth, hasChildren: r.hasChildren }))
}

function groupRows(rows: ListDisplayRow[]) {
  return rows
    .filter((r): r is Extract<ListDisplayRow, { kind: 'group' }> => r.kind === 'group')
    .map(r => ({ key: r.key, label: r.label, count: r.count }))
}

const emptyMembers = new Map<string, { displayName: string }>()
const emptyStatuses = new Map<string, { name: string }>()

// ── groupBy: none ─────────────────────────────────────────────────────────────

describe('buildListRows — groupBy: none', () => {
  it('returns one activity row per activity in order', () => {
    const activities = [act('a'), act('b'), act('c')]
    const rows = buildListRows(activities, 'none', emptyMembers, emptyStatuses, [], NONE)
    expect(actRows(rows).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty array for an empty list', () => {
    expect(buildListRows([], 'none', emptyMembers, emptyStatuses, [], NONE)).toEqual([])
  })
})

// ── groupBy: member ───────────────────────────────────────────────────────────

describe('buildListRows — groupBy: member', () => {
  const members = new Map([
    ['m1', { displayName: 'Alice' }],
    ['m2', { displayName: 'Bob' }],
  ])
  const activities = [
    act('a1', { assignedMemberIds: ['m1'] }),
    act('a2', { assignedMemberIds: ['m1'] }),
    act('b1', { assignedMemberIds: ['m2'] }),
    act('u1'),  // unassigned
  ]

  it('emits a group header per member then their activities', () => {
    const rows = buildListRows(activities, 'member', members, emptyStatuses, [], NONE)
    const groups = groupRows(rows)
    expect(groups[0]).toMatchObject({ label: 'Alice', count: 2 })
    expect(groups[1]).toMatchObject({ label: 'Bob', count: 1 })
    expect(groups[2]).toMatchObject({ key: '__unassigned__', label: 'Unassigned', count: 1 })
  })

  it('hides collapsed group activities but keeps the group header', () => {
    const m1Key = 'm1'
    const rows = buildListRows(activities, 'member', members, emptyStatuses, [], new Set([m1Key]))
    const ids = rows.map(r => r.kind === 'group' ? `G:${r.key}` : `A:${r.activity.id}`)
    expect(ids).not.toContain('A:a1')
    expect(ids).not.toContain('A:a2')
    expect(ids).toContain(`G:${m1Key}`)
    expect(ids).toContain('A:b1')
  })
})

// ── groupBy: status ───────────────────────────────────────────────────────────

describe('buildListRows — groupBy: status', () => {
  const statuses = [status('s1', 'In Progress'), status('s2', 'Done')]
  const statusMap = new Map(statuses.map(s => [s.id, s]))
  const activities = [
    act('a', { statusId: 's1' }),
    act('b', { statusId: 's2' }),
    act('c'),  // no status
  ]

  it('emits statuses in ROADMAP order, no-status last', () => {
    const rows = buildListRows(activities, 'status', emptyMembers, statusMap, statuses, NONE)
    const groups = groupRows(rows)
    expect(groups.map(g => g.label)).toEqual(['In Progress', 'Done', 'No status'])
  })

  it('skips statuses with no activities', () => {
    const rows = buildListRows([act('a', { statusId: 's1' })], 'status', emptyMembers, statusMap, statuses, NONE)
    const groups = groupRows(rows)
    expect(groups.map(g => g.label)).toEqual(['In Progress'])
  })
})

// ── groupBy: parent ───────────────────────────────────────────────────────────

describe('buildListRows — groupBy: parent', () => {
  const activities = [
    act('a'),
    act('b', { parentActivityId: 'a' }),
    act('c', { parentActivityId: 'b' }),
    act('d'),
  ]

  it('nests grandchildren at increasing depth', () => {
    const rows = buildListRows(activities, 'parent', emptyMembers, emptyStatuses, [], NONE)
    expect(actRows(rows)).toEqual([
      { id: 'a', depth: 0, hasChildren: true },
      { id: 'b', depth: 1, hasChildren: true },
      { id: 'c', depth: 2, hasChildren: false },
      { id: 'd', depth: 0, hasChildren: false },
    ])
  })

  it('hides subtree when parent is collapsed', () => {
    const rows = buildListRows(activities, 'parent', emptyMembers, emptyStatuses, [], new Set(['a']))
    expect(actRows(rows).map(r => r.id)).toEqual(['a', 'd'])
  })

  it('treats an orphan (parent not in view) as a root', () => {
    const rows = buildListRows([act('x', { parentActivityId: 'missing' })], 'parent', emptyMembers, emptyStatuses, [], NONE)
    expect(actRows(rows)).toEqual([{ id: 'x', depth: 0, hasChildren: false }])
  })

  it('does not infinite-loop on a parent-pointer cycle', () => {
    const x = act('x', { parentActivityId: 'y' })
    const y = act('y', { parentActivityId: 'x' })
    const rows = buildListRows([x, y], 'parent', emptyMembers, emptyStatuses, [], NONE)
    expect(actRows(rows).map(r => r.id).sort()).toEqual(['x', 'y'])
  })
})
