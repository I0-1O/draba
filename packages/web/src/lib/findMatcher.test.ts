import { describe, it, expect } from 'vitest'
import { matchEvents } from './findMatcher'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiEvent = components['schemas']['Event']

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice Smith',   initials: 'AS', color: '#288C9B' },
  { id: 'm2', name: 'Bob Jones',     initials: 'BJ', color: '#F29E4C' },
  { id: 'm3', name: 'Charlie Brown', initials: 'CB', color: '#5BC0DE' },
]

function makeEvent(overrides: Partial<ApiEvent> & { id: string; title: string }): ApiEvent {
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

const EVENTS: ApiEvent[] = [
  makeEvent({ id: 'e1', title: 'Alpha Launch',        description: 'Ship the first version' }),
  makeEvent({ id: 'e2', title: 'Beta Testing',        description: 'Run QA on beta build', assignedMemberIds: ['m1'] }),
  makeEvent({ id: 'e3', title: 'Design Review',       description: null, assignedMemberIds: ['m2', 'm3'] }),
  makeEvent({ id: 'e4', title: 'Security Audit',      description: 'Check alice permissions' }),
  makeEvent({ id: 'e5', title: 'Parent Event',        description: null }),
  makeEvent({ id: 'e6', title: 'Child milestone',     description: null, parentEventId: 'e5' }),
  makeEvent({ id: 'e7', title: 'Another Child',       description: null, parentEventId: 'e5' }),
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchEvents', () => {
  it('returns empty array for empty query', () => {
    expect(matchEvents('', EVENTS, MEMBERS, EVENTS)).toHaveLength(0)
    expect(matchEvents('   ', EVENTS, MEMBERS, EVENTS)).toHaveLength(0)
  })

  it('matches event title, case-insensitive', () => {
    const results = matchEvents('alpha', EVENTS, MEMBERS, EVENTS)
    expect(results).toHaveLength(1)
    expect(results[0].eventId).toBe('e1')
    expect(results[0].reasons).toContain('title')
  })

  it('matches description', () => {
    const results = matchEvents('QA on beta', EVENTS, MEMBERS, EVENTS)
    expect(results).toHaveLength(1)
    expect(results[0].eventId).toBe('e2')
    expect(results[0].reasons).toContain('description')
  })

  it('matches assignee display name', () => {
    const results = matchEvents('alice', EVENTS, MEMBERS, EVENTS)
    // e2 assigns Alice Smith; e4 has "alice" in description
    const matchedIds = results.map(r => r.eventId)
    expect(matchedIds).toContain('e2')
    expect(matchedIds).toContain('e4')
    const e2 = results.find(r => r.eventId === 'e2')!
    expect(e2.reasons).toContain('assignee: Alice Smith')
    const e4 = results.find(r => r.eventId === 'e4')!
    expect(e4.reasons).toContain('description')
  })

  it('matches parent event title for child events', () => {
    const results = matchEvents('parent event', EVENTS, MEMBERS, EVENTS)
    const matchedIds = results.map(r => r.eventId)
    // e5 matches by title; e6 and e7 match by parent title
    expect(matchedIds).toContain('e5')
    expect(matchedIds).toContain('e6')
    expect(matchedIds).toContain('e7')
    const e6 = results.find(r => r.eventId === 'e6')!
    expect(e6.reasons.some(r => r.startsWith('parent:'))).toBe(true)
  })

  it('is case-insensitive for all match fields', () => {
    expect(matchEvents('ALPHA', EVENTS, MEMBERS, EVENTS).map(r => r.eventId)).toContain('e1')
    expect(matchEvents('AlPhA', EVENTS, MEMBERS, EVENTS).map(r => r.eventId)).toContain('e1')
    expect(matchEvents('ALICE', EVENTS, MEMBERS, EVENTS).map(r => r.eventId)).toContain('e2')
    expect(matchEvents('bob', EVENTS, MEMBERS, EVENTS).map(r => r.eventId)).toContain('e3')
  })

  it('reports multiple reasons when multiple fields match', () => {
    // e2: title contains "beta", description contains "beta", no assignee match for "beta"
    const results = matchEvents('beta', EVENTS, MEMBERS, EVENTS)
    const e2 = results.find(r => r.eventId === 'e2')!
    expect(e2.reasons).toContain('title')
    expect(e2.reasons).toContain('description')
  })

  it('does not include events outside the visible set', () => {
    // Only pass e1 as visible
    const results = matchEvents('alpha', [EVENTS[0]], MEMBERS, EVENTS)
    expect(results).toHaveLength(1)
    expect(results[0].eventId).toBe('e1')

    // e2 not visible — should not appear
    const results2 = matchEvents('alpha', [EVENTS[1]], MEMBERS, EVENTS)
    expect(results2).toHaveLength(0)
  })

  it('returns empty when nothing matches', () => {
    expect(matchEvents('xyznonexistent', EVENTS, MEMBERS, EVENTS)).toHaveLength(0)
  })

  it('handles events with no optional fields gracefully', () => {
    const bare = makeEvent({ id: 'bare', title: 'Bare event' })
    expect(() => matchEvents('bare', [bare], [], [])).not.toThrow()
    const results = matchEvents('bare', [bare], [], [])
    expect(results[0].eventId).toBe('bare')
  })
})
