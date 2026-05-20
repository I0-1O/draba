/**
 * findMatcher — pure client-side event search.
 *
 * Matches against already-fetched events using the debounced query string.
 * Only fields present in the OpenAPI Event schema are searched; tags are
 * deferred until the API adds them (Phase ?). Parent-event title lookup
 * requires allEvents (the full fetched list, not just the visible slice).
 */

import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiEvent = components['schemas']['Event']

export interface MatchResult {
  eventId: string
  /** Human-readable match reasons, e.g. ['description', 'assignee: Jane']. */
  reasons: string[]
}

/**
 * Returns a MatchResult for each event in visibleEvents that contains query
 * in any searchable field. The first reason is 'title' when the title matches;
 * other reasons are labelled by field for use in the "why matched" tooltip.
 */
export function matchEvents(
  query: string,
  visibleEvents: ApiEvent[],
  members: Member[],
  allEvents: ApiEvent[],
): MatchResult[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const memberById = new Map(members.map(m => [m.id, m.name]))
  const eventById = new Map(allEvents.map(e => [e.id, e]))

  const results: MatchResult[] = []

  for (const ev of visibleEvents) {
    const reasons: string[] = []

    if (ev.title.toLowerCase().includes(q)) reasons.push('title')

    if (ev.description && ev.description.toLowerCase().includes(q)) reasons.push('description')

    for (const memberId of ev.assignedMemberIds ?? []) {
      const name = memberById.get(memberId)
      if (name && name.toLowerCase().includes(q)) {
        reasons.push(`assignee: ${name}`)
      }
    }

    if (ev.parentEventId) {
      const parent = eventById.get(ev.parentEventId)
      if (parent && parent.title.toLowerCase().includes(q)) {
        reasons.push(`parent: ${parent.title}`)
      }
    }

    if (reasons.length > 0) results.push({ eventId: ev.id, reasons })
  }

  return results
}
