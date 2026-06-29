/**
 * textExport — client-side Markdown, plain-text, and HTML generation for the
 * Export dialog's Phase 14.2 textual formats.
 *
 * All generators are pure functions: they accept pre-resolved lookup maps
 * (produced in DashboardPage) and return plain strings. No DOM access, no
 * network calls — identical output to what the user sees on screen.
 *
 * View-specific generators:
 *   buildList*    — GFM table (Markdown) / space-padded table (plain) / HTML <table>
 *   buildKanban*  — one section per column
 *   buildCalendar* — agenda-style date-grouped list
 */

import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']

// ── Public types ───────────────────────────────────────────────────────────────

/**
 * A pre-built list display row for export.
 * Group rows produce section headers; activity rows produce content.
 * Mirrors the subset of ListDisplayRow used outside the component.
 */
export type ListExportRow =
  | { kind: 'group'; label: string; count: number }
  | { kind: 'activity'; activity: ApiActivity; depth: number }

/** All data the text generators need — supplied by DashboardPage at export time. */
export interface TextExportData {
  /**
   * Filtered activities.
   * Calendar generators iterate this directly. List generators use listDisplayRows instead.
   */
  activities: ApiActivity[]
  /** Member ID → display name. */
  memberById: Map<string, string>
  /** Status ID → status name. */
  statusById: Map<string, string>
  /** Tag ID → tag name. */
  tagById: Map<string, string>
  /** Activity ID → title (for parent-activity name lookups). */
  activityTitleById: Map<string, string>
  /**
   * Kanban-only: pre-built columns produced by `buildColumns`.
   * Null for List and Calendar views.
   * When kanbanShowHierarchy=true, column items contain only root activities.
   */
  kanbanColumns: Array<{ label: string; activities: ApiActivity[] }> | null
  /**
   * List-only: pre-built display rows in sorted, group-by order.
   * Group rows emit section headers; activity rows carry a depth for hierarchy.
   * Null for non-List views.
   */
  listDisplayRows: ListExportRow[] | null
  /**
   * List-only: ordered visible column IDs (excluding visual-only colorBar/identity).
   * Null means use the default set of export columns.
   */
  listVisibleColumns: string[] | null
  /** Kanban-only: true when hierarchy nesting is active in the view. */
  kanbanShowHierarchy: boolean
  /** Kanban-only: parent ID → child activities (populated when kanbanShowHierarchy=true). */
  kanbanChildrenByParentId: Map<string, ApiActivity[]>
}

// ── Date formatting ────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

function fmtDateRange(startAt: string | null | undefined, endAt: string | null | undefined): string {
  const s = fmtDate(startAt)
  const e = fmtDate(endAt)
  if (s === '—' && e === '—') return '—'
  if (s === e) return s
  return `${s} – ${e}`
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function resolveAssignees(activity: ApiActivity, memberById: Map<string, string>): string {
  if (!activity.assignedMemberIds?.length) return '—'
  return activity.assignedMemberIds.map(id => memberById.get(id) ?? id).join(', ')
}

function resolveTags(activity: ApiActivity, tagById: Map<string, string>): string {
  if (!activity.tagIds?.length) return ''
  return activity.tagIds.map(id => `#${tagById.get(id) ?? id}`).join(' ')
}

function buildHeader(timelineName: string, filterLabel: string | null): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  const parts = [`# ${timelineName} — ${today}`]
  if (filterLabel) parts.push(`_Filter: ${filterLabel}_`)
  parts.push('')
  return parts.join('\n')
}

function buildPlainHeader(timelineName: string, filterLabel: string | null): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  const parts = [`${timelineName} — ${today}`]
  if (filterLabel) parts.push(`Filter: ${filterLabel}`)
  parts.push('')
  return parts.join('\n')
}

function escMd(s: string): string {
  return s.replace(/\|/g, '\\|')
}

function htmlEsc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── List column helpers ────────────────────────────────────────────────────────

const COLUMN_LABELS: Record<string, string> = {
  title: 'Title',
  startAt: 'Start',
  endAt: 'End',
  duration: 'Duration',
  status: 'Status',
  assignees: 'Assigned To',
  tags: 'Tags',
  progress: 'Progress',
  parent: 'Parent',
  description: 'Description',
  location: 'Location',
  url: 'URL',
  notes: 'Notes',
  createdAt: 'Created',
  updatedAt: 'Updated',
}

const SKIP_EXPORT_COLS = new Set(['colorBar', 'identity'])

/** Default columns emitted when listVisibleColumns is null. */
const DEFAULT_EXPORT_COL_IDS = [
  'title', 'startAt', 'endAt', 'status', 'assignees', 'tags', 'progress', 'parent',
]

function resolveListColumns(ids: string[] | null): Array<{ id: string; label: string }> {
  const use = ids ?? DEFAULT_EXPORT_COL_IDS
  return use
    .filter(id => !SKIP_EXPORT_COLS.has(id) && id in COLUMN_LABELS)
    .map(id => ({ id, label: COLUMN_LABELS[id] }))
}

function getColValue(
  colId: string,
  activity: ApiActivity,
  memberById: Map<string, string>,
  statusById: Map<string, string>,
  tagById: Map<string, string>,
  activityTitleById: Map<string, string>,
): string {
  switch (colId) {
    case 'title': return activity.title
    case 'startAt': return fmtDate(activity.startAt)
    case 'endAt': return fmtDate(activity.endAt)
    case 'duration': {
      if (!activity.startAt || !activity.endAt) return '—'
      const days = Math.round(
        (new Date(activity.endAt).getTime() - new Date(activity.startAt).getTime()) / 86400000,
      )
      if (days < 0) return '—'
      return `${days + 1} day${days + 1 !== 1 ? 's' : ''}`
    }
    case 'status': return activity.statusId ? (statusById.get(activity.statusId) ?? '—') : '—'
    case 'assignees': return resolveAssignees(activity, memberById)
    case 'tags': return resolveTags(activity, tagById) || '—'
    case 'progress': return activity.percentComplete != null ? `${activity.percentComplete}%` : '—'
    case 'parent': return activity.parentActivityId
      ? (activityTitleById.get(activity.parentActivityId) ?? '—')
      : '—'
    case 'description': return activity.description ?? '—'
    case 'location': return activity.location ?? '—'
    case 'url': return activity.url ?? '—'
    // notes is in the DB schema but may be absent from the strict generated TS type
    case 'notes': return (activity as ApiActivity & { notes?: string | null }).notes ?? '—'
    case 'createdAt': return fmtDate(activity.createdAt)
    case 'updatedAt': return fmtDate(activity.updatedAt)
    default: return '—'
  }
}

/** Returns the depth-prefix for a title cell: '' at depth 0, '↳ ' at depth 1, '  ↳ ' at depth 2, etc. */
function depthPrefix(depth: number): string {
  if (depth === 0) return ''
  return `${'  '.repeat(depth - 1)}↳ `
}

// ── Markdown generators ────────────────────────────────────────────────────────

/**
 * List view → Markdown outline (bullet list).
 * One bullet per activity; only non-empty fields are emitted as indented lines.
 * Children are nested bullets (depth × 2 spaces of leading indent).
 * Group-by produces ## sections.
 */
export function buildListMarkdownOutline(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, memberById, statusById, tagById, activityTitleById } = data
  const lines: string[] = [buildHeader(timelineName, filterLabel)]

  if (!listDisplayRows || listDisplayRows.length === 0) {
    lines.push('_No activities._')
    return lines.join('\n')
  }

  const fmtActivity = (activity: ApiActivity, bulletIndent: string): string[] => {
    const result: string[] = []
    const datePart = fmtDateRange(activity.startAt, activity.endAt)
    const assignees = resolveAssignees(activity, memberById)
    let firstLine = `${bulletIndent}- **${escMd(activity.title)}**`
    if (datePart !== '—') firstLine += ` (${datePart})`
    if (assignees !== '—') firstLine += ` — ${assignees}`
    result.push(firstLine)

    const fi = `${bulletIndent}  `
    if (activity.description) result.push(`${fi}${escMd(activity.description)}`)
    const status = activity.statusId ? statusById.get(activity.statusId) : null
    if (status) result.push(`${fi}Status: ${escMd(status)}`)
    if (activity.percentComplete != null) result.push(`${fi}Progress: ${activity.percentComplete}%`)
    const parent = activity.parentActivityId ? activityTitleById.get(activity.parentActivityId) : null
    if (parent) result.push(`${fi}Parent: ${escMd(parent)}`)
    const tags = resolveTags(activity, tagById)
    if (tags) result.push(`${fi}Tags: ${tags}`)
    if (activity.location) result.push(`${fi}Location: ${escMd(activity.location)}`)
    if (activity.url) result.push(`${fi}URL: ${escMd(activity.url)}`)
    return result
  }

  const hasGroups = listDisplayRows.some(r => r.kind === 'group')

  if (hasGroups) {
    let firstGroup = true
    for (const row of listDisplayRows) {
      if (row.kind === 'group') {
        if (!firstGroup) lines.push('')
        lines.push(`## ${row.label} (${row.count})`)
        lines.push('')
        firstGroup = false
      } else {
        lines.push(...fmtActivity(row.activity, '  '.repeat(row.depth)))
        lines.push('')
      }
    }
  } else {
    for (const row of listDisplayRows) {
      if (row.kind === 'activity') {
        lines.push(...fmtActivity(row.activity, '  '.repeat(row.depth)))
        lines.push('')
      }
    }
  }

  return lines.join('\n').trimEnd()
}

/** List view → GitHub-flavored Markdown table, respecting column visibility, sort, group-by, and hierarchy. */
export function buildListMarkdown(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, listVisibleColumns, memberById, statusById, tagById, activityTitleById } = data
  const lines: string[] = [buildHeader(timelineName, filterLabel)]

  const cols = resolveListColumns(listVisibleColumns)
  const thead = `| ${cols.map(c => c.label).join(' | ')} |`
  const tsep = `| ${cols.map(() => '---').join(' | ')} |`

  const getCells = (activity: ApiActivity, depth: number) =>
    cols.map(c => {
      const val = getColValue(c.id, activity, memberById, statusById, tagById, activityTitleById)
      const pfx = c.id === 'title' ? depthPrefix(depth) : ''
      return escMd(pfx + val)
    })

  if (!listDisplayRows || listDisplayRows.length === 0) {
    lines.push(thead, tsep)
    if (!listDisplayRows || listDisplayRows.length === 0) lines.push('_No activities._')
    return lines.join('\n')
  }

  const hasGroups = listDisplayRows.some(r => r.kind === 'group')

  if (hasGroups) {
    // member or status group-by: one GFM table per section
    let firstGroup = true
    for (const row of listDisplayRows) {
      if (row.kind === 'group') {
        if (!firstGroup) lines.push('')
        lines.push(`## ${row.label} (${row.count})`)
        lines.push('')
        lines.push(thead)
        lines.push(tsep)
        firstGroup = false
      } else {
        lines.push(`| ${getCells(row.activity, row.depth).join(' | ')} |`)
      }
    }
  } else {
    // flat (none) or parent-hierarchy mode: single table, depth prefix in title
    lines.push(thead, tsep)
    for (const row of listDisplayRows) {
      if (row.kind === 'activity') {
        lines.push(`| ${getCells(row.activity, row.depth).join(' | ')} |`)
      }
    }
  }

  return lines.join('\n')
}

/** Kanban view → one Markdown section per column, with optional hierarchy nesting. */
export function buildKanbanMarkdown(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { kanbanColumns, activities, memberById, statusById, tagById, kanbanShowHierarchy, kanbanChildrenByParentId } = data
  const lines: string[] = [buildHeader(timelineName, filterLabel)]
  const cols = kanbanColumns ?? [{ label: 'Activities', activities }]

  const fmtItem = (a: ApiActivity, indent: string): string => {
    const parts: string[] = [a.title]
    const assignees = resolveAssignees(a, memberById)
    if (assignees !== '—') parts.push(assignees)
    const range = fmtDateRange(a.startAt, a.endAt)
    if (range !== '—') parts.push(range)
    const status = a.statusId ? (statusById.get(a.statusId) ?? null) : null
    if (status) parts.push(status)
    const tags = resolveTags(a, tagById)
    if (tags) parts.push(tags)
    return `${indent}- ${parts.join(' · ')}`
  }

  for (const col of cols) {
    if (col.activities.length === 0) continue
    lines.push(`## ${col.label} (${col.activities.length})`)
    for (const a of col.activities) {
      lines.push(fmtItem(a, ''))
      if (kanbanShowHierarchy) {
        for (const child of kanbanChildrenByParentId.get(a.id) ?? []) {
          lines.push(fmtItem(child, '  '))
        }
      }
    }
    lines.push('')
  }

  if (cols.every(c => c.activities.length === 0)) lines.push('_No activities._')
  return lines.join('\n').trimEnd()
}

/** Calendar view → agenda-style date-grouped Markdown list. */
export function buildCalendarMarkdown(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { activities, memberById, tagById } = data
  const lines: string[] = [buildHeader(timelineName, filterLabel)]

  if (activities.length === 0) {
    lines.push('_No activities._')
    return lines.join('\n')
  }

  const byDate = new Map<string, ApiActivity[]>()
  for (const a of activities) {
    const key = a.startAt?.slice(0, 10) ?? '__none__'
    const bucket = byDate.get(key) ?? []
    bucket.push(a)
    byDate.set(key, bucket)
  }

  for (const key of [...byDate.keys()].sort()) {
    const acts = byDate.get(key)!
    const dateLabel = key === '__none__'
      ? 'No date'
      : new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        })
    lines.push(`## ${dateLabel}`)
    for (const a of acts) {
      const parts: string[] = [a.title]
      if (a.endAt && a.endAt.slice(0, 10) !== key) parts.push(`→ ${fmtDate(a.endAt)}`)
      const assignees = resolveAssignees(a, memberById)
      if (assignees !== '—') parts.push(assignees)
      const tags = resolveTags(a, tagById)
      if (tags) parts.push(tags)
      lines.push(`- ${parts.join(' · ')}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

// ── Plain-text generators ──────────────────────────────────────────────────────

function pad(s: string, width: number): string {
  return s.length >= width ? s : `${s}${' '.repeat(width - s.length)}`
}

/**
 * List view → plain-text outline (bullet list).
 * Mirrors buildListMarkdownOutline without Markdown syntax — fields (incl. URL)
 * are emitted raw since there's no Markdown table/pipe syntax to break here.
 * Root activities use •, children use ◦ (depth 1+).
 */
export function buildListPlainTextOutline(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, memberById, statusById, tagById, activityTitleById } = data
  const lines: string[] = [buildPlainHeader(timelineName, filterLabel)]

  if (!listDisplayRows || listDisplayRows.length === 0) {
    lines.push('No activities.')
    return lines.join('\n')
  }

  const fmtActivity = (activity: ApiActivity, depth: number): string[] => {
    const result: string[] = []
    const bulletIndent = '  '.repeat(depth)
    const bullet = depth === 0 ? '•' : '◦'
    const datePart = fmtDateRange(activity.startAt, activity.endAt)
    const assignees = resolveAssignees(activity, memberById)
    let firstLine = `${bulletIndent}${bullet} ${activity.title}`
    if (datePart !== '—') firstLine += ` (${datePart})`
    if (assignees !== '—') firstLine += ` — ${assignees}`
    result.push(firstLine)

    const fi = `${bulletIndent}  `
    if (activity.description) result.push(`${fi}${activity.description}`)
    const status = activity.statusId ? statusById.get(activity.statusId) : null
    if (status) result.push(`${fi}Status: ${status}`)
    if (activity.percentComplete != null) result.push(`${fi}Progress: ${activity.percentComplete}%`)
    const parent = activity.parentActivityId ? activityTitleById.get(activity.parentActivityId) : null
    if (parent) result.push(`${fi}Parent: ${parent}`)
    const tags = resolveTags(activity, tagById)
    if (tags) result.push(`${fi}Tags: ${tags}`)
    if (activity.location) result.push(`${fi}Location: ${activity.location}`)
    if (activity.url) result.push(`${fi}URL: ${activity.url}`)
    return result
  }

  const hasGroups = listDisplayRows.some(r => r.kind === 'group')

  if (hasGroups) {
    let firstGroup = true
    for (const row of listDisplayRows) {
      if (row.kind === 'group') {
        if (!firstGroup) lines.push('')
        const heading = `${row.label.toUpperCase()} (${row.count})`
        lines.push(heading)
        lines.push('─'.repeat(heading.length))
        firstGroup = false
      } else {
        lines.push(...fmtActivity(row.activity, row.depth))
        lines.push('')
      }
    }
  } else {
    for (const row of listDisplayRows) {
      if (row.kind === 'activity') {
        lines.push(...fmtActivity(row.activity, row.depth))
        lines.push('')
      }
    }
  }

  return lines.join('\n').trimEnd()
}

/** List view → space-padded plain-text table, respecting column visibility, sort, group-by, and hierarchy. */
export function buildListPlainText(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, listVisibleColumns, memberById, statusById, tagById, activityTitleById } = data
  const lines: string[] = [buildPlainHeader(timelineName, filterLabel)]

  const cols = resolveListColumns(listVisibleColumns)
  const MAX_W: Record<string, number> = {
    title: 40, startAt: 15, endAt: 15, duration: 10, status: 20,
    assignees: 26, tags: 20, progress: 10, parent: 24, description: 30,
    location: 20, url: 30, notes: 30, createdAt: 15, updatedAt: 15,
  }

  const getRenderedValue = (colId: string, activity: ApiActivity, depth: number): string => {
    const val = getColValue(colId, activity, memberById, statusById, tagById, activityTitleById)
    const pfx = colId === 'title' ? depthPrefix(depth) : ''
    return pfx + val
  }

  const activityRows = (listDisplayRows ?? []).filter((r): r is { kind: 'activity'; activity: ApiActivity; depth: number } => r.kind === 'activity')
  const fallbackActivities = activityRows.length > 0
    ? activityRows.map(r => ({ activity: r.activity, depth: r.depth }))
    : data.activities.map(a => ({ activity: a, depth: 0 }))

  if (fallbackActivities.length === 0) {
    lines.push('No activities.')
    return lines.join('\n')
  }

  // Compute column widths from actual rendered content
  const widths = cols.map(col => {
    let w = col.label.length
    for (const { activity, depth } of fallbackActivities) {
      const rendered = getRenderedValue(col.id, activity, depth)
      w = Math.max(w, Math.min(rendered.length, MAX_W[col.id] ?? 20))
    }
    return w
  })

  const emitTableHeader = () => {
    lines.push(cols.map((c, i) => pad(c.label, widths[i])).join('  '))
    lines.push(widths.map(w => '─'.repeat(w)).join('  '))
  }

  const emitRow = (activity: ApiActivity, depth: number) => {
    lines.push(
      cols.map((c, i) => {
        const rendered = getRenderedValue(c.id, activity, depth)
        return pad(rendered.slice(0, widths[i]), widths[i])
      }).join('  '),
    )
  }

  if (!listDisplayRows) {
    emitTableHeader()
    for (const { activity, depth } of fallbackActivities) emitRow(activity, depth)
    return lines.join('\n')
  }

  const hasGroups = listDisplayRows.some(r => r.kind === 'group')

  if (hasGroups) {
    let firstGroup = true
    for (const row of listDisplayRows) {
      if (row.kind === 'group') {
        if (!firstGroup) lines.push('')
        const heading = `${row.label.toUpperCase()} (${row.count})`
        lines.push(heading)
        lines.push('─'.repeat(heading.length))
        emitTableHeader()
        firstGroup = false
      } else {
        emitRow(row.activity, row.depth)
      }
    }
  } else {
    emitTableHeader()
    for (const row of listDisplayRows) {
      if (row.kind === 'activity') emitRow(row.activity, row.depth)
    }
  }

  return lines.join('\n')
}

/** Kanban view → plain-text sections with bullet lists. */
export function buildKanbanPlainText(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { kanbanColumns, activities, memberById, statusById, tagById, kanbanShowHierarchy, kanbanChildrenByParentId } = data
  const lines: string[] = [buildPlainHeader(timelineName, filterLabel)]
  const cols = kanbanColumns ?? [{ label: 'Activities', activities }]

  const fmtItem = (a: ApiActivity): string => {
    const parts: string[] = [a.title]
    const assignees = resolveAssignees(a, memberById)
    if (assignees !== '—') parts.push(assignees)
    const range = fmtDateRange(a.startAt, a.endAt)
    if (range !== '—') parts.push(range)
    const status = a.statusId ? (statusById.get(a.statusId) ?? null) : null
    if (status) parts.push(status)
    const tags = resolveTags(a, tagById)
    if (tags) parts.push(tags)
    return parts.join(' · ')
  }

  for (const col of cols) {
    if (col.activities.length === 0) continue
    const heading = `${col.label.toUpperCase()} (${col.activities.length})`
    lines.push(heading)
    lines.push('─'.repeat(heading.length))
    for (const a of col.activities) {
      lines.push(`  • ${fmtItem(a)}`)
      if (kanbanShowHierarchy) {
        for (const child of kanbanChildrenByParentId.get(a.id) ?? []) {
          lines.push(`      ◦ ${fmtItem(child)}`)
        }
      }
    }
    lines.push('')
  }

  if (cols.every(c => c.activities.length === 0)) lines.push('No activities.')
  return lines.join('\n').trimEnd()
}

/** Calendar view → plain-text agenda. */
export function buildCalendarPlainText(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { activities, memberById, tagById } = data
  const lines: string[] = [buildPlainHeader(timelineName, filterLabel)]

  if (activities.length === 0) { lines.push('No activities.'); return lines.join('\n') }

  const byDate = new Map<string, ApiActivity[]>()
  for (const a of activities) {
    const key = a.startAt?.slice(0, 10) ?? '__none__'
    const bucket = byDate.get(key) ?? []
    bucket.push(a)
    byDate.set(key, bucket)
  }

  for (const key of [...byDate.keys()].sort()) {
    const acts = byDate.get(key)!
    const dateLabel = key === '__none__'
      ? 'No date'
      : new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        })
    lines.push(dateLabel)
    lines.push('─'.repeat(dateLabel.length))
    for (const a of acts) {
      const parts: string[] = [a.title]
      if (a.endAt && a.endAt.slice(0, 10) !== key) parts.push(`→ ${fmtDate(a.endAt)}`)
      const assignees = resolveAssignees(a, memberById)
      if (assignees !== '—') parts.push(assignees)
      const tags = resolveTags(a, tagById)
      if (tags) parts.push(tags)
      lines.push(`  • ${parts.join(' · ')}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

// ── HTML generators (for clipboard text/html flavor) ──────────────────────────

const TH = 'padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;font-weight:600;text-align:left;white-space:nowrap;font-family:system-ui,sans-serif;font-size:13px'
const TD = 'padding:5px 10px;border:1px solid #ddd;vertical-align:top;font-family:system-ui,sans-serif;font-size:13px'

function htmlHeaderBlock(timelineName: string, filterLabel: string | null): string {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const ctx = filterLabel ? ` · Filter: ${htmlEsc(filterLabel)}` : ''
  return `<p style="font-family:system-ui,sans-serif;font-size:13px;margin:0 0 10px"><strong>${htmlEsc(timelineName)}</strong> — ${today}${ctx}</p>`
}

/** List view → HTML table for clipboard, respecting column visibility, sort, group-by, and hierarchy. */
export function buildListHtml(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, listVisibleColumns, memberById, statusById, tagById, activityTitleById } = data
  const cols = resolveListColumns(listVisibleColumns)

  const theadRow = `<tr>${cols.map(c => `<th style="${TH}">${htmlEsc(c.label)}</th>`).join('')}</tr>`
  const thead = `<thead>${theadRow}</thead>`
  const colspan = cols.length

  const makeRow = (activity: ApiActivity, depth: number): string => {
    const cells = cols.map(c => {
      const val = getColValue(c.id, activity, memberById, statusById, tagById, activityTitleById)
      const paddingLeft = c.id === 'title' && depth > 0 ? `padding-left:${6 + depth * 16}px;` : ''
      const prefix = c.id === 'title' && depth > 0 ? '↳ ' : ''
      return `<td style="${paddingLeft}${TD}">${htmlEsc(prefix + val)}</td>`
    })
    return `<tr>${cells.join('')}</tr>`
  }

  const makeSection = (label: string, count: number): string =>
    `<tr><th colspan="${colspan}" style="${TH};background:#e8e8e8;font-size:12px">${htmlEsc(label)} (${count})</th></tr>`

  const rows: string[] = []
  const activityList = listDisplayRows ?? data.activities.map(a => ({ kind: 'activity' as const, activity: a, depth: 0 }))

  if (activityList.length === 0) {
    rows.push(`<tr><td colspan="${colspan}" style="${TD}"><em>No activities.</em></td></tr>`)
  } else {
    for (const row of activityList) {
      if (row.kind === 'group') {
        rows.push(makeSection(row.label, row.count))
        rows.push(theadRow)
      } else {
        rows.push(makeRow(row.activity, row.depth))
      }
    }
  }

  return `${htmlHeaderBlock(timelineName, filterLabel)}<table style="border-collapse:collapse">${thead}<tbody>${rows.join('')}</tbody></table>`
}

/** List view → HTML outline (bullet list) for clipboard. Mirrors buildListMarkdownOutline. */
export function buildListHtmlOutline(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { listDisplayRows, memberById, statusById, tagById, activityTitleById } = data

  const LI = 'font-family:system-ui,sans-serif;font-size:13px;margin:3px 0'
  const FIELD = 'font-family:system-ui,sans-serif;font-size:12px;color:#555;margin:1px 0 1px 0'

  const fmtActivity = (activity: ApiActivity, depth: number): string => {
    const datePart = fmtDateRange(activity.startAt, activity.endAt)
    const assignees = resolveAssignees(activity, memberById)
    let firstLine = `<strong>${htmlEsc(activity.title)}</strong>`
    if (datePart !== '—') firstLine += ` <span style="color:#777">(${htmlEsc(datePart)})</span>`
    if (assignees !== '—') firstLine += ` — ${htmlEsc(assignees)}`

    const fields: string[] = []
    if (activity.description) fields.push(htmlEsc(activity.description))
    const status = activity.statusId ? statusById.get(activity.statusId) : null
    if (status) fields.push(`Status: ${htmlEsc(status)}`)
    if (activity.percentComplete != null) fields.push(`Progress: ${activity.percentComplete}%`)
    const parent = activity.parentActivityId ? activityTitleById.get(activity.parentActivityId) : null
    if (parent) fields.push(`Parent: ${htmlEsc(parent)}`)
    const tags = resolveTags(activity, tagById)
    if (tags) fields.push(`Tags: ${htmlEsc(tags)}`)
    if (activity.location) fields.push(`Location: ${htmlEsc(activity.location)}`)
    if (activity.url) fields.push(`URL: ${htmlEsc(activity.url)}`)

    const fieldHtml = fields.length > 0
      ? `<div style="margin:2px 0 0 0">${fields.map(f => `<div style="${FIELD}">${f}</div>`).join('')}</div>`
      : ''

    const paddingLeft = depth > 0 ? `padding-left:${depth * 20}px;` : ''
    return `<li style="${paddingLeft}${LI}">${firstLine}${fieldHtml}</li>`
  }

  const activityList = listDisplayRows ?? data.activities.map(a => ({ kind: 'activity' as const, activity: a, depth: 0 }))

  if (activityList.length === 0) {
    return `${htmlHeaderBlock(timelineName, filterLabel)}<p style="font-family:system-ui,sans-serif;font-size:13px"><em>No activities.</em></p>`
  }

  const hasGroups = activityList.some(r => r.kind === 'group')
  const sections: string[] = []

  if (hasGroups) {
    let items: string[] = []
    let groupLabel = ''
    let groupCount = 0
    const flush = () => {
      if (groupLabel) sections.push(`<h3 style="font-family:system-ui,sans-serif;font-size:14px;margin:16px 0 4px">${htmlEsc(groupLabel)} (${groupCount})</h3><ul style="margin:0;padding-left:20px">${items.join('')}</ul>`)
    }
    for (const row of activityList) {
      if (row.kind === 'group') {
        flush()
        groupLabel = row.label
        groupCount = row.count
        items = []
      } else {
        items.push(fmtActivity(row.activity, row.depth))
      }
    }
    flush()
  } else {
    const items = activityList
      .filter((r): r is { kind: 'activity'; activity: ApiActivity; depth: number } => r.kind === 'activity')
      .map(r => fmtActivity(r.activity, r.depth))
    sections.push(`<ul style="margin:0;padding-left:20px">${items.join('')}</ul>`)
  }

  return `${htmlHeaderBlock(timelineName, filterLabel)}${sections.join('')}`
}

/** Kanban view → HTML sections with optional hierarchy nesting. */
export function buildKanbanHtml(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { kanbanColumns, activities, memberById, statusById, tagById, kanbanShowHierarchy, kanbanChildrenByParentId } = data
  const cols = kanbanColumns ?? [{ label: 'Activities', activities }]

  const fmtLi = (a: ApiActivity, style: string): string => {
    const parts: string[] = [htmlEsc(a.title)]
    const assignees = resolveAssignees(a, memberById)
    if (assignees !== '—') parts.push(htmlEsc(assignees))
    const range = fmtDateRange(a.startAt, a.endAt)
    if (range !== '—') parts.push(htmlEsc(range))
    const status = a.statusId ? (statusById.get(a.statusId) ?? null) : null
    if (status) parts.push(htmlEsc(status))
    const tags = resolveTags(a, tagById)
    if (tags) parts.push(htmlEsc(tags))
    return `<li style="${style}">${parts.join(' · ')}</li>`
  }

  const LI = 'font-family:system-ui,sans-serif;font-size:13px;margin:2px 0'
  const LI_CHILD = 'font-family:system-ui,sans-serif;font-size:12px;margin:2px 0;color:#555'

  const sections = cols
    .filter(c => c.activities.length > 0)
    .map(col => {
      const items: string[] = []
      for (const a of col.activities) {
        const children = kanbanShowHierarchy ? (kanbanChildrenByParentId.get(a.id) ?? []) : []
        if (children.length > 0) {
          const childList = children.map(c => fmtLi(c, LI_CHILD)).join('')
          items.push(`<li style="${LI}">${[htmlEsc(a.title), ...([resolveAssignees(a, memberById)].filter(s => s !== '—'))].join(' · ')}<ul style="margin:2px 0;padding-left:16px">${childList}</ul></li>`)
        } else {
          items.push(fmtLi(a, LI))
        }
      }
      return `<h3 style="font-family:system-ui,sans-serif;font-size:14px;margin:16px 0 4px">${htmlEsc(col.label)} (${col.activities.length})</h3><ul style="margin:0;padding-left:20px">${items.join('')}</ul>`
    })

  const body = sections.length > 0 ? sections.join('') : '<p style="font-family:system-ui,sans-serif;font-size:13px"><em>No activities.</em></p>'
  return `${htmlHeaderBlock(timelineName, filterLabel)}${body}`
}

/** Calendar view → HTML agenda. */
export function buildCalendarHtml(
  data: TextExportData,
  timelineName: string,
  filterLabel: string | null,
): string {
  const { activities, memberById, tagById } = data
  if (activities.length === 0) {
    return `${htmlHeaderBlock(timelineName, filterLabel)}<p style="font-family:system-ui,sans-serif;font-size:13px"><em>No activities.</em></p>`
  }

  const byDate = new Map<string, ApiActivity[]>()
  for (const a of activities) {
    const key = a.startAt?.slice(0, 10) ?? '__none__'
    const bucket = byDate.get(key) ?? []
    bucket.push(a)
    byDate.set(key, bucket)
  }

  const sections = [...byDate.keys()].sort().map(key => {
    const acts = byDate.get(key)!
    const dateLabel = key === '__none__'
      ? 'No date'
      : new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
        })
    const items = acts.map(a => {
      const parts: string[] = [htmlEsc(a.title)]
      if (a.endAt && a.endAt.slice(0, 10) !== key) parts.push(`→ ${htmlEsc(fmtDate(a.endAt))}`)
      const assignees = resolveAssignees(a, memberById)
      if (assignees !== '—') parts.push(htmlEsc(assignees))
      const tags = resolveTags(a, tagById)
      if (tags) parts.push(htmlEsc(tags))
      return `<li style="font-family:system-ui,sans-serif;font-size:13px;margin:2px 0">${parts.join(' · ')}</li>`
    })
    return `<h3 style="font-family:system-ui,sans-serif;font-size:14px;margin:16px 0 4px">${htmlEsc(dateLabel)}</h3><ul style="margin:0;padding-left:20px">${items.join('')}</ul>`
  })

  return `${htmlHeaderBlock(timelineName, filterLabel)}${sections.join('')}`
}
