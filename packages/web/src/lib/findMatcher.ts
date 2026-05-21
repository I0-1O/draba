/**
 * findMatcher — pure client-side activity search.
 *
 * Matches against already-fetched activities using the debounced query string.
 * Only fields present in the OpenAPI Activity schema are searched; tags are
 * deferred until the API adds them (Phase ?). Parent-activity title lookup
 * requires allActivities (the full fetched list, not just the visible slice).
 */

import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']

export interface MatchResult {
  activityId: string
  /** Human-readable match reasons, e.g. ['description', 'assignee: Jane']. */
  reasons: string[]
}

/**
 * Returns a MatchResult for each activity in visibleActivities that contains
 * query in any searchable field. The first reason is 'title' when the title
 * matches; other reasons are labelled by field for use in the "why matched"
 * tooltip.
 */
export function matchEvents(
  query: string,
  visibleActivities: ApiActivity[],
  members: Member[],
  allActivities: ApiActivity[],
): MatchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const memberById = new Map(members.map(m => [m.id, m.name]))
  const activityById = new Map(allActivities.map(a => [a.id, a]))

  const results: MatchResult[] = []

  for (const ev of visibleActivities) {
    const reasons: string[] = []

    if (ev.title.toLowerCase().includes(q)) reasons.push('title')

    if (ev.description && ev.description.toLowerCase().includes(q)) reasons.push('description')

    for (const memberId of ev.assignedMemberIds ?? []) {
      const name = memberById.get(memberId)
      if (name && name.toLowerCase().includes(q)) {
        reasons.push(`assignee: ${name}`)
      }
    }

    if (ev.parentActivityId) {
      const parent = activityById.get(ev.parentActivityId)
      if (parent && parent.title.toLowerCase().includes(q)) {
        reasons.push(`parent: ${parent.title}`)
      }
    }

    if (reasons.length > 0) results.push({ activityId: ev.id, reasons })
  }

  return results
}
