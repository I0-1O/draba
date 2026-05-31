/**
 * Unified filter application for all filter kinds (presets, member, saved).
 *
 * applyActiveFilter is the single entry point used by GanttView (and future
 * List/Calendar/Kanban views). All preset logic lives here so it's testable
 * in isolation and reusable across views.
 */

import type { components } from '@draba/shared'
import type { ActiveFilter } from '@/contexts/FilterContext'
import { matchesFilter } from './filterEngine'
import type { FilterContext as EngineCtx } from './filterEngine'
import { parseFilterDefinition } from './filterTypes'

type Activity = components['schemas']['Activity']
type SavedFilter = components['schemas']['SavedFilter']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

export interface ApplyFilterContext {
  /** Status IDs whose is_closed flag is true — used by 'open' and 'overdue'. */
  closedStatusIds: Set<string>
  /** team_member_id values belonging to the currently logged-in user. */
  currentUserMemberIds: string[]
  /** All saved filters (user's own + team filters) for the active team. */
  savedFilters: SavedFilter[]
  /** For saved filter engine: timeline_id → statuses map. */
  statuses: Map<string, Status[]>
  /** For saved filter engine: all team tags. */
  tags: Tag[]
}

// ── Preset implementations ────────────────────────────────────────────────────

function filterAll(activities: Activity[]): Activity[] {
  return activities
}

function filterOpen(activities: Activity[], closedStatusIds: Set<string>): Activity[] {
  return activities.filter(a => !a.statusId || !closedStatusIds.has(a.statusId))
}

function filterUpcoming(activities: Activity[]): Activity[] {
  const now = Date.now()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const cutoff = now + sevenDays
  return activities.filter(a => {
    const start = a.startAt ? new Date(a.startAt).getTime() : null
    const end = a.endAt ? new Date(a.endAt).getTime() : null
    // Either starts or ends within the next 7 days (and hasn't already ended)
    const startsWithin = start !== null && start >= now && start <= cutoff
    const endsWithin = end !== null && end >= now && end <= cutoff
    return startsWithin || endsWithin
  })
}

function filterMy(activities: Activity[], currentUserMemberIds: string[]): Activity[] {
  if (currentUserMemberIds.length === 0) return []
  const idSet = new Set(currentUserMemberIds)
  return activities.filter(a =>
    (a.assignedMemberIds ?? []).some(mid => idSet.has(mid))
  )
}

function filterOverdue(activities: Activity[], closedStatusIds: Set<string>): Activity[] {
  const now = Date.now()
  return activities.filter(a => {
    if (!a.endAt) return false
    const end = new Date(a.endAt).getTime()
    if (end >= now) return false
    // Not closed
    return !a.statusId || !closedStatusIds.has(a.statusId)
  })
}

function filterNoAssign(activities: Activity[]): Activity[] {
  return activities.filter(a => (a.assignedMemberIds ?? []).length === 0)
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Apply the active filter to a list of activities. Returns the filtered subset.
 *
 * @param activities - All activities to filter (already fetched for the timeline).
 * @param activeFilter - The currently selected filter from FilterContext.
 * @param memberIdsByUserId - Map of userId → team_member_id[] for the team.
 *   Used to resolve the 'member' filter kind.
 * @param ctx - Context data needed by presets and the saved filter engine.
 */
export function applyActiveFilter(
  activities: Activity[],
  activeFilter: ActiveFilter,
  memberIdsByUserId: Map<string, string[]>,
  ctx: ApplyFilterContext,
): Activity[] {
  if (activeFilter.kind === 'preset') {
    switch (activeFilter.id) {
      case 'all':       return filterAll(activities)
      case 'open':      return filterOpen(activities, ctx.closedStatusIds)
      case 'upcoming':  return filterUpcoming(activities)
      case 'my':        return filterMy(activities, ctx.currentUserMemberIds)
      case 'overdue':   return filterOverdue(activities, ctx.closedStatusIds)
      case 'noassign':  return filterNoAssign(activities)
    }
  }

  if (activeFilter.kind === 'member') {
    const memberIds = memberIdsByUserId.get(activeFilter.userId) ?? []
    if (memberIds.length === 0) return []
    const idSet = new Set(memberIds)
    return activities.filter(a =>
      (a.assignedMemberIds ?? []).some(mid => idSet.has(mid))
    )
  }

  if (activeFilter.kind === 'saved') {
    const saved = ctx.savedFilters.find(f => f.id === activeFilter.id)
    if (!saved) return activities // filter not found — show all
    const def = parseFilterDefinition(saved.definition)
    if (!def) return activities // invalid definition — show all
    const engineCtx: EngineCtx = {
      statusesByTimeline: ctx.statuses,
      tags: ctx.tags,
    }
    return activities.filter(a => matchesFilter(a, def, engineCtx))
  }

  return activities
}
