import { describe, it, expect } from 'vitest'
import { matchEvents } from './findMatcher'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice Smith',   initials: 'AS', color: '#288C9B' },
  { id: 'm2', name: 'Bob Jones',     initials: 'BJ', color: '#F29E4C' },
  { id: 'm3', name: 'Charlie Brown', initials: 'CB', color: '#5BC0DE' },
]

function makeActivity(overrides: Partial<ApiActivity> & { id: string; title: string }): ApiActivity {
  return {
    teamId: 'team-1',
    startAt: '2026-01-01T00:00:00Z',
    endAt: '2026-01-07T00:00:00Z',
    allDay: true,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const ACTIVITIES: ApiActivity[] = [
  makeActivity({ id: 'e1', title: 'Alpha Launch',        description: 'Ship the first version' }),
  makeActivity({ id: 'e2', title: 'Beta Testing',        description: 'Run QA on beta build', assignedMemberIds: ['m1'] }),
  makeActivity({ id: 'e3', title: 'Design Review',       description: null, assignedMemberIds: ['m2', 'm3'] }),
  makeActivity({ id: 'e4', title: 'Security Audit',      description: 'Check alice permissions' }),
  makeActivity({ id: 'e5', title: 'Parent Activity',     description: null }),
  makeActivity({ id: 'e6', title: 'Child milestone',     description: null, parentActivityId: 'e5' }),
  makeActivity({ id: 'e7', title: 'Another Child',       description: null, parentActivityId: 'e5' }),
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchEvents', () => {
  it('returns empty array for empty query', () => {
    expect(matchEvents('', ACTIVITIES, MEMBERS, ACTIVITIES)).toHaveLength(0)
    expect(matchEvents('   ', ACTIVITIES, MEMBERS, ACTIVITIES)).toHaveLength(0)
  })

  it('matches activity title, case-insensitive', () => {
    const results = matchEvents('alpha', ACTIVITIES, MEMBERS, ACTIVITIES)
    expect(results).toHaveLength(1)
    expect(results[0].activityId).toBe('e1')
    expect(results[0].reasons).toContain('title')
  })

  it('matches description', () => {
    const results = matchEvents('QA on beta', ACTIVITIES, MEMBERS, ACTIVITIES)
    expect(results).toHaveLength(1)
    expect(results[0].activityId).toBe('e2')
    expect(results[0].reasons).toContain('description')
  })

  it('matches assignee display name', () => {
    const results = matchEvents('alice', ACTIVITIES, MEMBERS, ACTIVITIES)
    // e2 assigns Alice Smith; e4 has "alice" in description
    const matchedIds = results.map(r => r.activityId)
    expect(matchedIds).toContain('e2')
    expect(matchedIds).toContain('e4')
    const e2 = results.find(r => r.activityId === 'e2')!
    expect(e2.reasons).toContain('assignee: Alice Smith')
    const e4 = results.find(r => r.activityId === 'e4')!
    expect(e4.reasons).toContain('description')
  })

  it('matches parent activity title for child activities', () => {
    const results = matchEvents('parent activity', ACTIVITIES, MEMBERS, ACTIVITIES)
    const matchedIds = results.map(r => r.activityId)
    // e5 matches by title; e6 and e7 match by parent title
    expect(matchedIds).toContain('e5')
    expect(matchedIds).toContain('e6')
    expect(matchedIds).toContain('e7')
    const e6 = results.find(r => r.activityId === 'e6')!
    expect(e6.reasons.some(r => r.startsWith('parent:'))).toBe(true)
  })

  it('is case-insensitive for all match fields', () => {
    expect(matchEvents('ALPHA', ACTIVITIES, MEMBERS, ACTIVITIES).map(r => r.activityId)).toContain('e1')
    expect(matchEvents('AlPhA', ACTIVITIES, MEMBERS, ACTIVITIES).map(r => r.activityId)).toContain('e1')
    expect(matchEvents('ALICE', ACTIVITIES, MEMBERS, ACTIVITIES).map(r => r.activityId)).toContain('e2')
    expect(matchEvents('bob', ACTIVITIES, MEMBERS, ACTIVITIES).map(r => r.activityId)).toContain('e3')
  })

  it('reports multiple reasons when multiple fields match', () => {
    // e2: title contains "beta", description contains "beta", no assignee match for "beta"
    const results = matchEvents('beta', ACTIVITIES, MEMBERS, ACTIVITIES)
    const e2 = results.find(r => r.activityId === 'e2')!
    expect(e2.reasons).toContain('title')
    expect(e2.reasons).toContain('description')
  })

  it('does not include activities outside the visible set', () => {
    // Only pass e1 as visible
    const results = matchEvents('alpha', [ACTIVITIES[0]], MEMBERS, ACTIVITIES)
    expect(results).toHaveLength(1)
    expect(results[0].activityId).toBe('e1')

    // e2 not visible — should not appear
    const results2 = matchEvents('alpha', [ACTIVITIES[1]], MEMBERS, ACTIVITIES)
    expect(results2).toHaveLength(0)
  })

  it('returns empty when nothing matches', () => {
    expect(matchEvents('xyznonexistent', ACTIVITIES, MEMBERS, ACTIVITIES)).toHaveLength(0)
  })

  it('handles activities with no optional fields gracefully', () => {
    const bare = makeActivity({ id: 'bare', title: 'Bare activity' })
    expect(() => matchEvents('bare', [bare], [], [])).not.toThrow()
    const results = matchEvents('bare', [bare], [], [])
    expect(results[0].activityId).toBe('bare')
  })
})
