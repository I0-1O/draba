/**
 * buildRows — tree nesting and collapse behaviour.
 *
 * Covers the parent→child depth nesting (arbitrary levels), parent subtree
 * collapse, and member-group collapse added for the Gantt expand/contract work.
 */

import { describe, it, expect } from 'vitest'
import { buildRows, type RichActivity } from './GanttView'
import type { GanttRow } from './GanttGrid'
import type { Member } from '@/types'

// Minimal RichActivity factory — only the fields buildRows reads matter.
function act(id: string, parentActivityId: string | null, memberId: string | null = null): RichActivity {
  return {
    id,
    title: id,
    startCol: 0,
    span: 1,
    color: '#000',
    members: [],
    isChild: false,
    startAtMs: 0,
    endAtMs: 0,
    parentActivityId,
    primaryMemberId: memberId,
    assignedMemberIds: memberId ? [memberId] : [],
    statusId: null,
  }
}

const NONE = new Set<string>()

// Pull the activity rows out as [id, depth] tuples for concise assertions.
function activityTuples(rows: GanttRow[]): Array<[string, number]> {
  return rows
    .filter((r): r is Extract<GanttRow, { kind: 'activity' }> => r.kind === 'activity')
    .map(r => [r.event.id, r.event.depth ?? 0])
}

describe('buildRows — parent grouping (tree nesting)', () => {
  // a → b → c (grandchild), plus a standalone root d
  const activities = [act('a', null), act('b', 'a'), act('c', 'b'), act('d', null)]

  it('nests grandchildren at increasing depth', () => {
    const rows = buildRows(activities, [], 'parent', 'title', NONE, NONE)
    expect(activityTuples(rows)).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 2],
      ['d', 0],
    ])
  })

  it('marks parents as hasChildren and leaves as not', () => {
    const rows = buildRows(activities, [], 'parent', 'title', NONE, NONE).filter(
      (r): r is Extract<GanttRow, { kind: 'activity' }> => r.kind === 'activity',
    )
    const byId = Object.fromEntries(rows.map(r => [r.event.id, r.event]))
    expect(byId.a.hasChildren).toBe(true)
    expect(byId.b.hasChildren).toBe(true)
    expect(byId.c.hasChildren).toBe(false)
    expect(byId.d.hasChildren).toBe(false)
  })

  it('hides the whole subtree when a parent is collapsed', () => {
    const rows = buildRows(activities, [], 'parent', 'title', new Set(['a']), NONE)
    // a stays (marked collapsed); b and c are hidden; d unaffected.
    expect(activityTuples(rows)).toEqual([
      ['a', 0],
      ['d', 0],
    ])
    const a = rows.find(r => r.kind === 'activity' && r.event.id === 'a')
    expect(a?.kind === 'activity' && a.event.collapsed).toBe(true)
  })

  it('collapsing a mid-level parent hides only its descendants', () => {
    const rows = buildRows(activities, [], 'parent', 'title', new Set(['b']), NONE)
    expect(activityTuples(rows)).toEqual([
      ['a', 0],
      ['b', 1],
      ['d', 0],
    ])
  })

  it('treats an activity whose parent is out of view as a root', () => {
    // orphan's parent "missing" is not in the set → orphan renders at depth 0.
    const rows = buildRows([act('orphan', 'missing')], [], 'parent', 'title', NONE, NONE)
    expect(activityTuples(rows)).toEqual([['orphan', 0]])
  })

  it('does not infinite-loop on a parent-pointer cycle', () => {
    const x = act('x', 'y')
    const y = act('y', 'x')
    const rows = buildRows([x, y], [], 'parent', 'title', NONE, NONE)
    // Both appear exactly once; exact ordering depends on sort but no dupes/hang.
    const ids = activityTuples(rows).map(t => t[0]).sort()
    expect(ids).toEqual(['x', 'y'])
  })
})

describe('buildRows — member grouping (combo-key grouping)', () => {
  const members: Member[] = [
    { id: 'm1', name: 'Alice', initials: 'A', color: '#111' },
    { id: 'm2', name: 'Bob', initials: 'B', color: '#222' },
  ]

  // Two activities assigned to m1 solo, one to m2 solo, one to both.
  function makeActivities() {
    const a1 = act('a1', null, 'm1')
    const a2 = act('a2', null, 'm1')
    const b1 = act('b1', null, 'm2')
    // Multi-assignee activity
    const ab1: RichActivity = { ...act('ab1', null, 'm1'), assignedMemberIds: ['m1', 'm2'] }
    return [a1, a2, b1, ab1]
  }

  it('emits one group per unique assignee combination in team order', () => {
    const rows = buildRows(makeActivities(), members, 'member', 'title', NONE, NONE)
    const groupIds = rows.filter(r => r.kind === 'group').map(r => r.kind === 'group' ? r.id : '')
    // m1 solo → m1+m2 combo → m2 solo (team order: Alice first)
    expect(groupIds[0]).toBe('m1')           // Alice solo
    // The combo key for m1+m2 is sorted by ID; exact string is implementation detail — just check it's not m1 or m2 solo
    expect(groupIds[1]).not.toBe('m1')
    expect(groupIds[1]).not.toBe('m2')
    expect(groupIds[2]).toBe('m2')           // Bob solo
  })

  it('places multi-assignee activity under its own combination group, not duplicated', () => {
    const rows = buildRows(makeActivities(), members, 'member', 'title', NONE, NONE)
    const actIds = rows.filter(r => r.kind === 'activity').map(r => r.kind === 'activity' ? r.event.id : '')
    // ab1 appears exactly once
    expect(actIds.filter(id => id === 'ab1')).toHaveLength(1)
    // Total activity count equals original (no duplication)
    expect(actIds).toHaveLength(4)
  })

  it('carries memberColors on group rows', () => {
    const rows = buildRows(makeActivities(), members, 'member', 'title', NONE, NONE)
    const groups = rows.filter((r): r is Extract<typeof r, { kind: 'group' }> => r.kind === 'group')
    for (const g of groups) {
      expect(Array.isArray(g.memberColors)).toBe(true)
    }
    // The combo group should have two colors
    const comboGroup = groups.find(g => g.memberColors && g.memberColors.length === 2)
    expect(comboGroup).toBeDefined()
  })

  it('hides a collapsed group activities but keeps the header', () => {
    const activities = [act('a1', null, 'm1'), act('a2', null, 'm1'), act('b1', null, 'm2')]
    const rows = buildRows(activities, members, 'member', 'title', NONE, new Set(['m1']))
    const labels = rows.map(r => (r.kind === 'group' ? `G:${r.id}` : `A:${r.event.id}`))
    expect(labels).toContain('G:m1')
    expect(labels).toContain('G:m2')
    expect(labels).toContain('A:b1')
    expect(labels).not.toContain('A:a1')
    expect(labels).not.toContain('A:a2')
    const g = rows.find(r => r.kind === 'group' && r.id === 'm1')
    expect(g?.kind === 'group' && g.collapsed).toBe(true)
  })

  it('places unassigned activities last', () => {
    const unassigned: RichActivity = { ...act('u1', null, null), assignedMemberIds: [] }
    const activities = [act('a1', null, 'm1'), unassigned]
    const rows = buildRows(activities, members, 'member', 'title', NONE, NONE)
    const groupIds = rows.filter(r => r.kind === 'group').map(r => r.kind === 'group' ? r.id : '')
    expect(groupIds[groupIds.length - 1]).toBe('__unassigned__')
  })
})
