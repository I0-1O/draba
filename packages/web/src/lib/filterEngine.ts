/**
 * Client-side filter evaluation engine.
 *
 * matchesFilter is a pure function that evaluates a FilterDefinition against
 * a single activity. It resolves status names and tag names via context objects
 * so callers supply the data; the engine does no fetching.
 */

import type { components } from '@draba/shared'
import type { FilterDefinition, FilterCondition, SetOp, StringOp, NumberOp, BoolOp, DateOp } from './filterTypes'

type Activity = components['schemas']['Activity']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

export interface FilterContext {
  /** Maps timeline_id → that timeline's statuses (for resolving statusId → name). */
  statusesByTimeline: Map<string, Status[]>
  /** All tags for the team (for resolving tagIds → names). */
  tags: Tag[]
}

// ── Operator helpers ──────────────────────────────────────────────────────────

function evalSetOp(op: SetOp, haystack: string[], needles: string[]): boolean {
  switch (op) {
    case 'in':
      return needles.some(n => haystack.includes(n))
    case 'not_in':
      return needles.every(n => !haystack.includes(n))
    case 'is_empty':
      return haystack.length === 0
    case 'is_not_empty':
      return haystack.length > 0
  }
}

function evalStringOp(op: StringOp, value: string | null | undefined, target: string): boolean {
  const v = (value ?? '').toLowerCase()
  const t = target.toLowerCase()
  switch (op) {
    case 'equals':       return v === t
    case 'not_equals':   return v !== t
    case 'contains':     return v.includes(t)
    case 'not_contains': return !v.includes(t)
    case 'is_empty':     return v.trim() === ''
    case 'is_not_empty': return v.trim() !== ''
  }
}

function evalNumberOp(op: NumberOp, value: number | null | undefined, target: number): boolean {
  if (op === 'is_empty')     return value == null
  if (op === 'is_not_empty') return value != null
  if (value == null) return false
  switch (op) {
    case 'equals':     return value === target
    case 'not_equals': return value !== target
    case 'gt':         return value > target
    case 'gte':        return value >= target
    case 'lt':         return value < target
    case 'lte':        return value <= target
  }
}

function evalBoolOp(op: BoolOp, value: boolean): boolean {
  return op === 'is_true' ? value : !value
}

function evalDateOp(op: DateOp, dateStr: string | null | undefined, target: string | [string, string] | undefined): boolean {
  if (op === 'is_empty')     return !dateStr
  if (op === 'is_not_empty') return Boolean(dateStr)
  if (!dateStr || !target) return false

  const date = new Date(dateStr).getTime()
  if (op === 'between') {
    const [from, to] = target as [string, string]
    return date >= new Date(from).getTime() && date <= new Date(to).getTime()
  }
  const targetDate = new Date(target as string).getTime()
  if (op === 'before') return date < targetDate
  if (op === 'after')  return date > targetDate
  return false
}

// ── Condition evaluation ──────────────────────────────────────────────────────

function evalCondition(condition: FilterCondition, activity: Activity, ctx: FilterContext): boolean {
  switch (condition.field) {
    case 'status': {
      const statuses = ctx.statusesByTimeline.get(activity.timelineId) ?? []
      const statusName = statuses.find(s => s.id === activity.statusId)?.name ?? null
      const haystack = statusName ? [statusName.toLowerCase()] : []
      // is_empty / is_not_empty don't use needles — guard before .map()
      const needles = (condition.value ?? []).map(v => v.toLowerCase())
      return evalSetOp(condition.op, haystack, needles)
    }

    case 'tag': {
      const tagMap = new Map(ctx.tags.map(t => [t.id, t.name.toLowerCase()]))
      const activityTagNames = (activity.tagIds ?? []).map(id => tagMap.get(id) ?? id)
      const needles = (condition.value ?? []).map(v => v.toLowerCase())
      return evalSetOp(condition.op, activityTagNames, needles)
    }

    case 'assignee': {
      const haystack = activity.assignedMemberIds ?? []
      return evalSetOp(condition.op, haystack, condition.value ?? [])
    }

    case 'title':
      return evalStringOp(condition.op, activity.title, condition.value)

    case 'progress':
      return evalNumberOp(condition.op, activity.percentComplete ?? null, condition.value)

    case 'hasParent':
      return evalBoolOp(condition.op, Boolean(activity.parentActivityId))

    case 'startDate':
      return evalDateOp(condition.op, activity.startAt ?? null, condition.value)

    case 'endDate':
      return evalDateOp(condition.op, activity.endAt ?? null, condition.value)
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns true when activity matches the given FilterDefinition.
 * An empty conditions array always matches (no filtering).
 */
export function matchesFilter(
  activity: Activity,
  filter: FilterDefinition,
  ctx: FilterContext,
): boolean {
  if (filter.conditions.length === 0) return true

  const results = filter.conditions.map(c => evalCondition(c, activity, ctx))
  return filter.logic === 'and'
    ? results.every(Boolean)
    : results.some(Boolean)
}
