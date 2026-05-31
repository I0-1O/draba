/**
 * presetFilters.test.ts — unit tests for applyActiveFilter.
 *
 * Covers each preset, the member filter kind, and saved filter delegation.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { applyActiveFilter } from './presetFilters'
import type { ActiveFilter } from '@/contexts/FilterContext'
import type { components } from '@draba/shared'

type Activity = components['schemas']['Activity']
type SavedFilter = components['schemas']['SavedFilter']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

// ── Fixtures ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeActivity(overrides: Record<string, any> = {}): Activity {
  return {
    id: 'act-1',
    title: 'Default',
    timelineId: 'tl-1',
    startAt: '2026-06-01T00:00:00Z',
    endAt: '2026-06-30T00:00:00Z',
    allDay: false,
    statusId: null,
    tagIds: [],
    assignedMemberIds: [],
    percentComplete: null,
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

// Fake the current date to a known value for date-relative tests
const FAKE_NOW = new Date('2026-06-01T00:00:00Z').getTime()
beforeAll(() => {
  vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW)
})
afterAll(() => {
  vi.restoreAllMocks()
})

const closedStatusId = 'status-closed'
const openStatusId = 'status-open'
const otherMemberId = 'member-other'

const baseCtx = {
  closedStatusIds: new Set([closedStatusId]),
  savedFilters: [] as SavedFilter[],
  statuses: new Map<string, Status[]>([['tl-1', [makeStatus(openStatusId, 'Open'), makeStatus(closedStatusId, 'Done', true)]]]),
  tags: [makeTag('tag-1', 'urgent')] as Tag[],
}

const emptyMemberIds = new Map<string, string[]>()

// ── all preset ────────────────────────────────────────────────────────────────

describe("preset 'all'", () => {
  it('returns all activities unchanged', () => {
    const activities = [makeActivity({ id: '1' }), makeActivity({ id: '2' })]
    const filter: ActiveFilter = { kind: 'preset', id: 'all' }
    expect(applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)).toHaveLength(2)
  })
})

// ── open preset ───────────────────────────────────────────────────────────────

describe("preset 'open'", () => {
  it('removes activities with a closed status', () => {
    const activities = [
      makeActivity({ id: 'a', statusId: openStatusId }),
      makeActivity({ id: 'b', statusId: closedStatusId }),
      makeActivity({ id: 'c', statusId: null }),
    ]
    const filter: ActiveFilter = { kind: 'preset', id: 'open' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result.map(a => a.id)).toEqual(['a', 'c'])
  })
})

// ── upcoming preset ───────────────────────────────────────────────────────────

describe("preset 'upcoming'", () => {
  // FAKE_NOW = 2026-06-01. 7 days = until 2026-06-08.
  it('includes activities starting within 7 days', () => {
    const activities = [
      makeActivity({ id: 'soon', startAt: '2026-06-05T00:00:00Z', endAt: '2026-06-06T00:00:00Z' }),  // within 7d
      makeActivity({ id: 'far',  startAt: '2026-07-01T00:00:00Z', endAt: '2026-07-15T00:00:00Z' }),  // beyond 7d
      makeActivity({ id: 'past', startAt: '2026-05-01T00:00:00Z', endAt: '2026-05-10T00:00:00Z' }),  // in past
    ]
    const filter: ActiveFilter = { kind: 'preset', id: 'upcoming' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result.map(a => a.id)).toContain('soon')
    expect(result.map(a => a.id)).not.toContain('far')
    expect(result.map(a => a.id)).not.toContain('past')
  })

  it('includes activities ending within 7 days (even if already started)', () => {
    const activities = [
      makeActivity({ id: 'ending-soon', endAt: '2026-06-04T00:00:00Z', startAt: '2026-05-01T00:00:00Z' }),
    ]
    const filter: ActiveFilter = { kind: 'preset', id: 'upcoming' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result[0].id).toBe('ending-soon')
  })
})

// ── overdue preset ────────────────────────────────────────────────────────────

describe("preset 'overdue'", () => {
  it('returns past-due activities that are not closed', () => {
    const activities = [
      makeActivity({ id: 'overdue',    endAt: '2026-05-01T00:00:00Z', statusId: openStatusId }),
      makeActivity({ id: 'closed-old', endAt: '2026-05-01T00:00:00Z', statusId: closedStatusId }),
      makeActivity({ id: 'future',     endAt: '2026-07-01T00:00:00Z', statusId: openStatusId }),
    ]
    const filter: ActiveFilter = { kind: 'preset', id: 'overdue' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result.map(a => a.id)).toEqual(['overdue'])
  })
})

// ── noassign preset ───────────────────────────────────────────────────────────

describe("preset 'noassign'", () => {
  it('returns only activities with no assignees', () => {
    const activities = [
      makeActivity({ id: 'assigned', assignedMemberIds: [otherMemberId] }),
      makeActivity({ id: 'free',     assignedMemberIds: [] }),
    ]
    const filter: ActiveFilter = { kind: 'preset', id: 'noassign' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result.map(a => a.id)).toEqual(['free'])
  })
})

// ── member filter kind ────────────────────────────────────────────────────────

describe("filter kind 'member'", () => {
  it('filters by the resolved member IDs for the userId', () => {
    const activities = [
      makeActivity({ id: 'a', assignedMemberIds: ['mbr-alice-1'] }),
      makeActivity({ id: 'b', assignedMemberIds: ['mbr-bob'] }),
    ]
    const memberIds = new Map([['user-alice', ['mbr-alice-1', 'mbr-alice-2']]])
    const filter: ActiveFilter = { kind: 'member', userId: 'user-alice' }
    const result = applyActiveFilter(activities, filter, memberIds, baseCtx)
    expect(result.map(a => a.id)).toEqual(['a'])
  })

  it('returns empty when user has no member IDs', () => {
    const activities = [makeActivity()]
    const filter: ActiveFilter = { kind: 'member', userId: 'unknown-user' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result).toHaveLength(0)
  })
})

// ── saved filter kind ─────────────────────────────────────────────────────────

describe("filter kind 'saved'", () => {
  it('evaluates a saved filter definition against activities', () => {
    const savedFilter: SavedFilter = {
      id: 'sf-1',
      teamId: 'team-1',
      userId: 'user-1',
      name: 'Urgent bugs',
      isTeamFilter: false,
      definition: JSON.stringify({
        logic: 'and',
        conditions: [{ field: 'title', op: 'contains', value: 'urgent' }],
      }),
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
    const activities = [
      makeActivity({ id: 'a', title: 'Fix urgent bug' }),
      makeActivity({ id: 'b', title: 'Refactor component' }),
    ]
    const ctx = { ...baseCtx, savedFilters: [savedFilter] }
    const filter: ActiveFilter = { kind: 'saved', id: 'sf-1' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, ctx)
    expect(result.map(a => a.id)).toEqual(['a'])
  })

  it('returns all activities when saved filter is not found', () => {
    const activities = [makeActivity({ id: 'a' }), makeActivity({ id: 'b' })]
    const filter: ActiveFilter = { kind: 'saved', id: 'nonexistent' }
    const result = applyActiveFilter(activities, filter, emptyMemberIds, baseCtx)
    expect(result).toHaveLength(2)
  })
})
