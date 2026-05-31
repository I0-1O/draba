/**
 * filterEngine.test.ts — unit tests for matchesFilter.
 *
 * Covers: each field type, each operator, AND/OR logic, edge cases
 * (empty conditions, null/missing fields, case-insensitive status/tag matching).
 */

import { describe, it, expect } from 'vitest'
import { matchesFilter, type FilterContext } from './filterEngine'
import type { components } from '@draba/shared'

type Activity = components['schemas']['Activity']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

// ── Fixtures ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeActivity(overrides: Record<string, any> = {}): Activity {
  return {
    id: 'act-1',
    title: 'Test activity',
    timelineId: 'tl-1',
    startAt: '2026-01-10T00:00:00Z',
    endAt: '2026-01-20T00:00:00Z',
    allDay: false,
    statusId: 'status-open',
    tagIds: ['tag-1'],
    assignedMemberIds: ['member-1'],
    percentComplete: 50,
    parentActivityId: null,
    color: null,
    icon: null,
    description: null,
    notes: null,
    location: null,
    url: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    archivedAt: null,
    createdBy: 'user-1',
    ...overrides,
  } as Activity
}

function makeStatus(id: string, name: string, isClosed = false): Status {
  return { id, name, color: '#3B82F6', icon: null, isClosed, position: 0, timelineId: 'tl-1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
}

function makeTag(id: string, name: string): Tag {
  return { id, name, color: null, teamId: 'team-1', createdAt: '2026-01-01T00:00:00Z', createdBy: 'user-1' }
}

const statusOpen = makeStatus('status-open', 'In Progress')
const statusClosed = makeStatus('status-closed', 'Done', true)

const tagBug = makeTag('tag-1', 'bug')
const tagFeat = makeTag('tag-2', 'feature')

const ctx: FilterContext = {
  statusesByTimeline: new Map([['tl-1', [statusOpen, statusClosed]]]),
  tags: [tagBug, tagFeat],
}

// ── Empty conditions ──────────────────────────────────────────────────────────

describe('empty conditions', () => {
  it('matches all activities when conditions list is empty', () => {
    const activity = makeActivity()
    expect(matchesFilter(activity, { logic: 'and', conditions: [] }, ctx)).toBe(true)
    expect(matchesFilter(activity, { logic: 'or', conditions: [] }, ctx)).toBe(true)
  })
})

// ── AND / OR logic ────────────────────────────────────────────────────────────

describe('AND / OR logic', () => {
  it('AND requires all conditions to pass', () => {
    const activity = makeActivity({ title: 'Hello world' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [
        { field: 'title', op: 'contains', value: 'Hello' },
        { field: 'title', op: 'contains', value: 'world' },
      ],
    }, ctx)).toBe(true)

    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [
        { field: 'title', op: 'contains', value: 'Hello' },
        { field: 'title', op: 'contains', value: 'missing' },
      ],
    }, ctx)).toBe(false)
  })

  it('OR requires at least one condition to pass', () => {
    const activity = makeActivity({ title: 'Hello world' })
    expect(matchesFilter(activity, {
      logic: 'or',
      conditions: [
        { field: 'title', op: 'contains', value: 'missing' },
        { field: 'title', op: 'contains', value: 'world' },
      ],
    }, ctx)).toBe(true)

    expect(matchesFilter(activity, {
      logic: 'or',
      conditions: [
        { field: 'title', op: 'contains', value: 'nope' },
        { field: 'title', op: 'contains', value: 'nada' },
      ],
    }, ctx)).toBe(false)
  })
})

// ── Status field ──────────────────────────────────────────────────────────────

describe('status field', () => {
  it('in: matches when status name is in the set (case-insensitive)', () => {
    const activity = makeActivity({ statusId: 'status-open' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'status', op: 'in', value: ['in progress'] }],
    }, ctx)).toBe(true)
  })

  it('in: no match when status name not in set', () => {
    const activity = makeActivity({ statusId: 'status-open' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'status', op: 'in', value: ['done'] }],
    }, ctx)).toBe(false)
  })

  it('not_in: matches when status name is NOT in the set', () => {
    const activity = makeActivity({ statusId: 'status-open' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'status', op: 'not_in', value: ['done'] }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when activity has no status', () => {
    const activity = makeActivity({ statusId: null })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'status', op: 'is_empty', value: [] }],
    }, ctx)).toBe(true)
  })

  it('is_not_empty: matches when activity has a status', () => {
    const activity = makeActivity({ statusId: 'status-open' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'status', op: 'is_not_empty', value: [] }],
    }, ctx)).toBe(true)
  })
})

// ── Tag field ─────────────────────────────────────────────────────────────────

describe('tag field', () => {
  it('in: matches by tag name (case-insensitive)', () => {
    const activity = makeActivity({ tagIds: ['tag-1'] }) // tag-1 = 'bug'
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'tag', op: 'in', value: ['BUG'] }],
    }, ctx)).toBe(true)
  })

  it('not_in: matches when none of the tag names match', () => {
    const activity = makeActivity({ tagIds: ['tag-1'] }) // 'bug'
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'tag', op: 'not_in', value: ['feature'] }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when activity has no tags', () => {
    const activity = makeActivity({ tagIds: [] })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'tag', op: 'is_empty', value: [] }],
    }, ctx)).toBe(true)
  })
})

// ── Assignee field ────────────────────────────────────────────────────────────

describe('assignee field', () => {
  it('in: matches when member ID is assigned', () => {
    const activity = makeActivity({ assignedMemberIds: ['member-1'] })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'assignee', op: 'in', value: ['member-1'] }],
    }, ctx)).toBe(true)
  })

  it('not_in: matches when member is not assigned', () => {
    const activity = makeActivity({ assignedMemberIds: ['member-2'] })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'assignee', op: 'not_in', value: ['member-1'] }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when no assignees', () => {
    const activity = makeActivity({ assignedMemberIds: [] })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'assignee', op: 'is_empty', value: [] }],
    }, ctx)).toBe(true)
  })
})

// ── Title field ───────────────────────────────────────────────────────────────

describe('title field', () => {
  it('contains: case-insensitive substring match', () => {
    const activity = makeActivity({ title: 'Fix the login bug' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'title', op: 'contains', value: 'LOGIN' }],
    }, ctx)).toBe(true)
  })

  it('not_contains: true when substring absent', () => {
    const activity = makeActivity({ title: 'Fix the login bug' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'title', op: 'not_contains', value: 'dashboard' }],
    }, ctx)).toBe(true)
  })

  it('equals: exact case-insensitive match', () => {
    const activity = makeActivity({ title: 'Hello World' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'title', op: 'equals', value: 'hello world' }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when title is empty string', () => {
    const activity = makeActivity({ title: '' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'title', op: 'is_empty', value: '' }],
    }, ctx)).toBe(true)
  })
})

// ── Progress field ────────────────────────────────────────────────────────────

describe('progress field', () => {
  it('gte: matches when progress is at or above threshold', () => {
    const activity = makeActivity({ percentComplete: 75 })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'progress', op: 'gte', value: 50 }],
    }, ctx)).toBe(true)
  })

  it('lt: matches when progress is below threshold', () => {
    const activity = makeActivity({ percentComplete: 25 })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'progress', op: 'lt', value: 50 }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when percentComplete is null/undefined', () => {
    const activity = makeActivity({ percentComplete: undefined })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'progress', op: 'is_empty', value: 0 }],
    }, ctx)).toBe(true)
  })
})

// ── hasParent field ───────────────────────────────────────────────────────────

describe('hasParent field', () => {
  it('is_true: matches activities with a parent', () => {
    const activity = makeActivity({ parentActivityId: 'parent-1' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'hasParent', op: 'is_true' }],
    }, ctx)).toBe(true)
  })

  it('is_false: matches activities without a parent', () => {
    const activity = makeActivity({ parentActivityId: null })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'hasParent', op: 'is_false' }],
    }, ctx)).toBe(true)
  })
})

// ── Date fields ───────────────────────────────────────────────────────────────

describe('date fields', () => {
  it('startDate before: matches when start is before the given date', () => {
    const activity = makeActivity({ startAt: '2026-01-05T00:00:00Z' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'startDate', op: 'before', value: '2026-01-10' }],
    }, ctx)).toBe(true)
  })

  it('endDate after: matches when end is after the given date', () => {
    const activity = makeActivity({ endAt: '2026-03-01T00:00:00Z' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'endDate', op: 'after', value: '2026-02-01' }],
    }, ctx)).toBe(true)
  })

  it('startDate between: matches when start is within range', () => {
    const activity = makeActivity({ startAt: '2026-06-15T00:00:00Z' })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'startDate', op: 'between', value: ['2026-06-01', '2026-06-30'] }],
    }, ctx)).toBe(true)
  })

  it('is_empty: matches when date is null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activity = makeActivity({ startAt: null as any })
    expect(matchesFilter(activity, {
      logic: 'and',
      conditions: [{ field: 'startDate', op: 'is_empty' }],
    }, ctx)).toBe(true)
  })
})
