import { describe, it, expect } from 'vitest'
import { filterOpenActivities } from './GanttView'

// ── filterOpenActivities — 'open' preset logic ────────────────────────────────

describe('filterOpenActivities', () => {
  const activities = [
    { id: '1', statusId: 'closed-a' },
    { id: '2', statusId: 'open-b' },
    { id: '3', statusId: null },
    { id: '4', statusId: undefined },
    { id: '5', statusId: 'closed-c' },
  ]

  it('removes activities whose statusId is in the closed set', () => {
    const closed = new Set(['closed-a', 'closed-c'])
    const result = filterOpenActivities(activities, closed)
    expect(result.map(a => a.id)).toEqual(['2', '3', '4'])
  })

  it('keeps activities with no status (null or undefined)', () => {
    const closed = new Set(['closed-a'])
    const result = filterOpenActivities(activities, closed)
    const noStatusIds = result.filter(a => !a.statusId).map(a => a.id)
    expect(noStatusIds).toContain('3')
    expect(noStatusIds).toContain('4')
  })

  it('returns all activities unchanged when closed set is empty', () => {
    const result = filterOpenActivities(activities, new Set())
    expect(result).toHaveLength(activities.length)
  })

  it('returns empty array when all activities are closed', () => {
    const closed = new Set(['closed-a', 'open-b', 'closed-c'])
    const onlyClosed = [
      { id: '1', statusId: 'closed-a' },
      { id: '5', statusId: 'closed-c' },
    ]
    const result = filterOpenActivities(onlyClosed, closed)
    expect(result).toHaveLength(0)
  })
})
