/**
 * ShareViewPage — public read-only view for a share link.
 *
 * Mounted at /s/:token outside ProtectedRoute. Fetches the ShareProjection
 * from the public gateway, then renders the Gantt in interactive=false mode
 * with the frozen view config (groupBy, sortBy, colorBy, granularity) applied.
 * Theme is forced to light — useLayoutEffect runs synchronously before paint so
 * it beats any dark-class applied from localStorage by useDarkMode.
 */

import { useMemo, useLayoutEffect, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useShareProjection, useUnlockShare } from '@/hooks/useShares'
import GanttGrid from '@/components/gantt/GanttGrid'
import { buildRows, type RichActivity } from '@/components/gantt/GanttView'
import {
  buildListRows,
  formatActivityDate,
  formatTimestamp,
  formatDuration,
  COL_CATALOG,
  type ListDisplayRow,
  type ColMeta,
} from '@/components/list/ListView'
import type { ListGroupBy, ListSortBy, ListColorBy } from '@/components/list/ListToolbar'
import KanbanBoard from '@/components/kanban/KanbanBoard'
import {
  buildColumns,
  buildHierarchyMaps,
  DEFAULT_CARD_FIELDS,
  type KanbanGroupBy,
  type KanbanSortBy,
} from '@/components/kanban/kanbanColumns'
import { resolveActivityColor } from '@/lib/activityColor'
import { resolveColorHex } from '@/components/identity/identity-constants'
import { MEMBER_COLORS, ACTIVITY_COLORS } from '@/types'
import {
  generateColumns,
  positionInColumns,
  todayColumnPosition,
  autoFitGranularity,
} from '@/components/gantt/granularity'
import { ApiError } from '@/lib/api'
import type { components } from '@draba/shared'
import type { GroupBy, SortBy, ColorBy, TimeGranularity } from '@/components/gantt/GanttToolbar'
import type { Member } from '@/types'
import { AlertCircle, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/components/identity/Badge'

type PublicActivity = components['schemas']['PublicActivity']
type PublicMember = components['schemas']['PublicMember']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']
type ApiActivity = components['schemas']['Activity']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

// ── View config parsing ───────────────────────────────────────────────────────

interface ParsedViewConfig {
  groupBy: GroupBy
  sortBy: SortBy
  colorBy: ColorBy
  granularity: TimeGranularity | 'auto'
}

function parseViewConfig(raw: string): ParsedViewConfig {
  try {
    const c = JSON.parse(raw) as Partial<ParsedViewConfig>
    return {
      groupBy: (c.groupBy as GroupBy) ?? 'none',
      sortBy: (c.sortBy as SortBy) ?? 'startDate',
      colorBy: (c.colorBy as ColorBy) ?? 'activity',
      granularity: c.granularity ?? 'auto',
    }
  } catch {
    return { groupBy: 'none', sortBy: 'startDate', colorBy: 'activity', granularity: 'auto' }
  }
}

interface ParsedListViewConfig {
  groupBy: ListGroupBy
  sortBy: ListSortBy
  colorBy: ListColorBy
  columns: { id: string; visible: boolean }[] | null
}

function parseListViewConfig(raw: string): ParsedListViewConfig {
  try {
    const c = JSON.parse(raw) as Partial<ParsedListViewConfig>
    return {
      groupBy: (c.groupBy as ListGroupBy) ?? 'none',
      sortBy: (c.sortBy as ListSortBy) ?? 'startDate',
      colorBy: (c.colorBy as ListColorBy) ?? 'activity',
      columns: Array.isArray(c.columns) ? c.columns : null,
    }
  } catch {
    return { groupBy: 'none', sortBy: 'startDate', colorBy: 'activity', columns: null }
  }
}

interface ParsedKanbanViewConfig {
  groupBy: KanbanGroupBy
  sortBy: KanbanSortBy
  colorBy: ColorBy
}

function parseKanbanViewConfig(raw: string): ParsedKanbanViewConfig {
  try {
    const c = JSON.parse(raw) as Partial<ParsedKanbanViewConfig>
    return {
      groupBy: (c.groupBy as KanbanGroupBy) ?? 'status',
      sortBy: (c.sortBy as KanbanSortBy) ?? 'startDate',
      colorBy: (c.colorBy as ColorBy) ?? 'activity',
    }
  } catch {
    return { groupBy: 'status', sortBy: 'startDate', colorBy: 'activity' }
  }
}

// ── Adapters: projection types → full API shapes ─────────────────────────────
//
// The List and Kanban renderers are built around the full Activity / TeamMember
// shapes (so they can be reused as-is from the authenticated app). The public
// projection only carries the fields a share is allowed to expose, so these
// adapters fill the remaining required-but-irrelevant fields with placeholder
// defaults — mirroring the `optimisticActivity` precedent in ListView.

function toApiActivity(a: PublicActivity, timelineId: string): ApiActivity {
  return {
    id: a.id,
    timelineId,
    title: a.title,
    description: a.description ?? null,
    notes: a.notes ?? null,
    icon: a.icon ?? null,
    color: a.color ?? null,
    startAt: a.startAt,
    endAt: a.endAt,
    allDay: a.allDay,
    statusId: a.statusId ?? null,
    parentActivityId: a.parentActivityId ?? null,
    percentComplete: a.percentComplete ?? null,
    location: null,
    url: null,
    rrule: null,
    caldavUid: null,
    googleEventId: null,
    createdBy: '',
    createdAt: a.startAt,
    updatedAt: a.startAt,
    archivedAt: null,
    assignedMemberIds: a.assignedMemberIds ?? [],
    tagIds: a.tagIds ?? [],
  }
}

function toTeamMemberWithUser(m: PublicMember): TeamMemberWithUser {
  return {
    id: m.id,
    teamId: '',
    userId: null,
    role: 'member',
    color: m.color ?? null,
    icon: m.icon ?? null,
    joinedAt: '',
    archivedAt: null,
    email: '',
    displayName: m.displayName,
    avatarUrl: null,
  }
}

function sortListActivities(activities: ApiActivity[], sortBy: ListSortBy): ApiActivity[] {
  const sorted = [...activities]
  sorted.sort((a, b) => {
    if (sortBy === 'startDate') return (a.startAt ?? '').localeCompare(b.startAt ?? '')
    if (sortBy === 'endDate') return (a.endAt ?? '').localeCompare(b.endAt ?? '')
    if (sortBy === 'title') return a.title.localeCompare(b.title)
    if (sortBy === 'status') return (a.statusId ?? '').localeCompare(b.statusId ?? '')
    if (sortBy === 'progress') return (b.percentComplete ?? 0) - (a.percentComplete ?? 0)
    return 0
  })
  return sorted
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function initialsFrom(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function toMember(m: PublicMember, index: number): Member {
  return {
    id: m.id,
    name: m.displayName,
    initials: initialsFrom(m.displayName),
    color: resolveColorHex(m.color) || MEMBER_COLORS[index % MEMBER_COLORS.length],
  }
}

// ── Public List table (read-only) ────────────────────────────────────────────
//
// ListView itself is a 2600-line data-fetching container with deep editing/
// drag/multiselect entanglement — unsuitable for the bypass-the-container
// pattern. Instead this lightweight renderer reuses ListView's pure helpers
// (buildListRows, COL_CATALOG, date formatters) to mirror its visuals without
// any interactivity: no clicks, editing, drag, context menus, or selection.

interface PublicListTableProps {
  rows: ListDisplayRow[]
  visibleColumns: ColMeta[]
  memberById: Map<string, PublicMember>
  statusById: Map<string, Status>
  tagById: Map<string, Tag>
  activityTitleById: Map<string, string>
}

function PublicListTable({ rows, visibleColumns, memberById, statusById, tagById, activityTitleById }: PublicListTableProps) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <colgroup>
          {visibleColumns.map(c => <col key={c.id} style={{ width: c.defaultWidth }} />)}
        </colgroup>
        <thead>
          <tr style={{ height: 36 }}>
            {visibleColumns.map(c => (
              <th key={c.id} style={{
                position: 'sticky', top: 0, zIndex: 2, background: '#f9fafb',
                borderBottom: '2px solid #e5e7eb', textAlign: 'left',
                fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
                letterSpacing: '0.04em', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleColumns.length} style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af', fontSize: 13 }}>
                No activities to show.
              </td>
            </tr>
          )}
          {rows.map((row, i) => {
            if (row.kind === 'group') {
              return (
                <tr key={`group-${row.key}`}>
                  <td colSpan={visibleColumns.length} style={{
                    padding: '4px 8px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb',
                    borderTop: i > 0 ? '1px solid #e5e7eb' : undefined, fontSize: 11, fontWeight: 600,
                    color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {row.memberColors && row.memberColors.length > 0 && (
                        <div style={{ display: 'flex', flexShrink: 0 }}>
                          {row.memberColors.map((c, j) => (
                            <div key={j} style={{ width: 9, height: 9, borderRadius: '50%', background: c, marginLeft: j === 0 ? 0 : -3, outline: '1.5px solid #f3f4f6' }} />
                          ))}
                        </div>
                      )}
                      {row.label}
                      <span style={{ fontWeight: 400, opacity: 0.6 }}>({row.count})</span>
                    </div>
                  </td>
                </tr>
              )
            }

            return (
              <tr key={row.activity.id} style={{ height: 36 }}>
                {visibleColumns.map(col => (
                  <PublicListCell
                    key={col.id}
                    colId={col.id}
                    activity={row.activity}
                    depth={row.depth}
                    memberById={memberById}
                    statusById={statusById}
                    tagById={tagById}
                    activityTitleById={activityTitleById}
                  />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PublicListCell({ colId, activity, depth, memberById, statusById, tagById, activityTitleById }: {
  colId: string
  activity: ApiActivity
  depth: number
  memberById: Map<string, PublicMember>
  statusById: Map<string, Status>
  tagById: Map<string, Tag>
  activityTitleById: Map<string, string>
}) {
  const cellStyle: React.CSSProperties = {
    padding: '0 8px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 12,
    color: '#111827',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    verticalAlign: 'middle',
  }

  switch (colId) {
    case 'colorBar':
      return <td style={{ ...cellStyle, padding: 0 }}><div style={{ width: 4, height: 24, borderRadius: 2, background: resolveColorHex(activity.color ?? null) ?? '#9ca3af', marginLeft: 6 }} /></td>

    case 'identity':
      return (
        <td style={{ ...cellStyle, textAlign: 'center' }}>
          <Badge identity={{ color: activity.color ?? '#288C9B', icon: activity.icon ?? '__none__' }} name={activity.title} shape="square" size={28} />
        </td>
      )

    case 'title':
      return (
        <td style={cellStyle}>
          <span style={{ paddingLeft: depth * 20, fontWeight: 500 }}>{activity.title}</span>
        </td>
      )

    case 'startAt':
      return <td style={cellStyle}>{formatActivityDate(activity.startAt)}</td>

    case 'endAt':
      return <td style={cellStyle}>{formatActivityDate(activity.endAt)}</td>

    case 'duration':
      return <td style={{ ...cellStyle, color: '#6b7280' }}>{formatDuration(activity.startAt, activity.endAt)}</td>

    case 'status': {
      const status = activity.statusId ? statusById.get(activity.statusId) : null
      const hex = status ? resolveColorHex(status.color ?? null) ?? '#888888' : null
      return (
        <td style={cellStyle}>
          {status ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4,
              fontSize: 11, fontWeight: 500, background: `${hex}26`, color: hex ?? '#111827', border: `1px solid ${hex}66`,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: hex ?? '#888', flexShrink: 0 }} />
              {status.name}
            </span>
          ) : <span style={{ color: '#9ca3af' }}>—</span>}
        </td>
      )
    }

    case 'assignees': {
      const ids = activity.assignedMemberIds ?? []
      const members = ids.map(id => memberById.get(id)).filter((m): m is PublicMember => Boolean(m))
      return (
        <td style={cellStyle}>
          <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            {members.length === 0 && <span style={{ color: '#9ca3af' }}>—</span>}
            {members.slice(0, 4).map((m, i) => (
              <div key={m.id} title={m.displayName} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <Badge identity={{ color: m.color ?? '#288C9B', icon: m.icon ?? '__name_2__' }} name={m.displayName} shape="circle" size={22} />
              </div>
            ))}
            {members.length > 4 && <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>+{members.length - 4}</span>}
          </div>
        </td>
      )
    }

    case 'tags': {
      const tags = (activity.tagIds ?? []).map(id => tagById.get(id)).filter((t): t is Tag => Boolean(t))
      return (
        <td style={cellStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            {tags.length === 0 && <span style={{ color: '#9ca3af' }}>—</span>}
            {tags.slice(0, 3).map(t => {
              const hex = resolveColorHex(t.color ?? null)
              return (
                <span key={t.id} style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap',
                  background: hex ? `${hex}26` : '#f3f4f6', color: hex ?? '#111827', border: `1px solid ${hex ?? '#e5e7eb'}66`,
                }}>
                  {t.name}
                </span>
              )
            })}
            {tags.length > 3 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{tags.length - 3}</span>}
          </div>
        </td>
      )
    }

    case 'progress': {
      const pct = activity.percentComplete ?? 0
      return (
        <td style={cellStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{pct}%</span>
          </div>
        </td>
      )
    }

    case 'description':
      return <td style={{ ...cellStyle, color: activity.description ? '#374151' : '#9ca3af' }}>{activity.description || '—'}</td>

    case 'notes':
      return <td style={{ ...cellStyle, color: activity.notes ? '#374151' : '#9ca3af' }}>{activity.notes || '—'}</td>

    case 'location':
      return <td style={{ ...cellStyle, color: '#9ca3af' }}>—</td>

    case 'url':
      return <td style={{ ...cellStyle, color: '#9ca3af' }}>—</td>

    case 'parent': {
      const parentTitle = activity.parentActivityId ? activityTitleById.get(activity.parentActivityId) : null
      return <td style={{ ...cellStyle, color: parentTitle ? '#374151' : '#9ca3af' }}>{parentTitle ?? '—'}</td>
    }

    case 'createdAt':
      return <td style={{ ...cellStyle, color: '#9ca3af' }}>{formatTimestamp(activity.createdAt)}</td>

    case 'updatedAt':
      return <td style={{ ...cellStyle, color: '#9ca3af' }}>{formatTimestamp(activity.updatedAt)}</td>

    default:
      return <td style={cellStyle} />
  }
}

// ── Unlock prompt (password-protected shares) ─────────────────────────────────

function UnlockPrompt({ token, onUnlocked }: { token: string | undefined; onUnlocked: (viewToken: string) => void }) {
  const unlock = useUnlockShare(token)
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw || unlock.isPending) return
    unlock.mutate(pw, { onSuccess: onUnlocked })
  }

  const err = unlock.error as ApiError | null
  const message = err
    ? err.status === 429
      ? 'Too many attempts. Please wait a minute and try again.'
      : 'Incorrect password. Please try again.'
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#ffffff', padding: 24, fontFamily: 'var(--font-sans)' }}>
      <form onSubmit={submit} style={{ width: 'min(380px, 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'hsl(30 87% 62% / 0.16)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <KeyRound size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>This view is password protected</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>Enter the password you were given to open it.</p>
        </div>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--input)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
          <KeyRound size={14} style={{ color: 'var(--muted-foreground)' }} strokeWidth={2} />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={pw}
            onChange={e => setPw(e.target.value)}
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            aria-label="Password"
            style={{ flex: 1, fontSize: 14, color: 'var(--foreground)', padding: '10px 0', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)' }}
          />
          <button type="button" onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4 }}>
            {showPw ? <EyeOff size={15} strokeWidth={2} /> : <Eye size={15} strokeWidth={2} />}
          </button>
        </div>
        {message && <p style={{ fontSize: 12.5, color: 'var(--destructive)', margin: 0 }}>{message}</p>}
        <button
          type="submit"
          disabled={!pw || unlock.isPending}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 14, fontWeight: 600, padding: '10px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: pw && !unlock.isPending ? 'pointer' : 'not-allowed', background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: pw && !unlock.isPending ? 1 : 0.55 }}
        >
          {unlock.isPending ? <Loader2 size={15} className="animate-spin" /> : null}
          {unlock.isPending ? 'Unlocking…' : 'Unlock view'}
        </button>
      </form>
    </div>
  )
}

// ── ShareViewPage ─────────────────────────────────────────────────────────────

export default function ShareViewPage() {
  const { token } = useParams<{ token: string }>()
  const [viewToken, setViewToken] = useState<string | null>(null)
  const { data: proj, isLoading, isError, error } = useShareProjection(token, viewToken)

  // Force light mode synchronously before first paint.
  // useLayoutEffect runs before the browser paints, beating any dark class set
  // from localStorage by useDarkMode during the same render cycle.
  useLayoutEffect(() => {
    const root = document.documentElement
    const hadDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (hadDark) root.classList.add('dark')
    }
  }, [])

  // Re-apply on mount in case ThemeSync fires after useLayoutEffect.
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  const vc = useMemo(
    () => parseViewConfig(proj?.share.viewConfig ?? '{}'),
    [proj?.share.viewConfig],
  )

  const { columns, resolvedGranularity } = useMemo(() => {
    if (!proj) return { columns: [], resolvedGranularity: 'week' as TimeGranularity }
    const start = new Date(proj.timeline.startDate)
    const end = new Date(proj.timeline.endDate)
    if (vc.granularity === 'auto') {
      const gr = autoFitGranularity(start, end, window.innerWidth || 1000)
      return { columns: generateColumns(start, end, gr), resolvedGranularity: gr }
    }
    return {
      columns: generateColumns(start, end, vc.granularity as TimeGranularity),
      resolvedGranularity: vc.granularity as TimeGranularity,
    }
  }, [proj, vc.granularity])

  const todayIdx = useMemo(() => todayColumnPosition(columns), [columns])

  const memberArray = useMemo<Member[]>(
    () => (proj?.members ?? []).map((m, i) => toMember(m, i)),
    [proj],
  )

  const memberById = useMemo(
    () => Object.fromEntries(memberArray.map(m => [m.id, m])),
    [memberArray],
  )

  const statusColorById = useMemo(() => {
    const m = new Map<string, string>()
    proj?.statuses.forEach((s: Status) => m.set(s.id, s.color))
    return m
  }, [proj])

  // Build RichActivity array (mirrors GanttView's toRichActivity).
  const richActivities = useMemo((): RichActivity[] => {
    if (!proj || columns.length === 0) return []
    const viewStart = columns[0].start
    const viewEnd = columns[columns.length - 1].end

    return proj.activities.flatMap((a: PublicActivity, i: number) => {
      const start = new Date(a.startAt)
      const end = new Date(a.endAt)
      if (end < viewStart || start > viewEnd) return []

      const clampedStart = start < viewStart ? viewStart : start
      const clampedEnd = end > viewEnd ? viewEnd : end
      const { startCol, span } = positionInColumns(clampedStart, clampedEnd, columns)

      const members = (a.assignedMemberIds ?? [])
        .map(id => memberById[id])
        .filter((m): m is Member => Boolean(m))

      let color: string
      if (vc.colorBy === 'member') {
        color = members[0]?.color ?? a.color ?? ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]
      } else if (vc.colorBy === 'status') {
        color = statusColorById.get(a.statusId ?? '') ?? '#6b7280'
      } else {
        color = a.color ?? ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]
      }

      return [{
        id: a.id,
        title: a.title,
        startCol,
        span,
        color,
        icon: a.icon ?? undefined,
        members,
        isChild: Boolean(a.parentActivityId),
        depth: 0,
        startAtMs: start.getTime(),
        endAtMs: end.getTime(),
        parentActivityId: a.parentActivityId ?? null,
        primaryMemberId: members[0]?.id ?? null,
        assignedMemberIds: a.assignedMemberIds ?? [],
        statusId: a.statusId ?? null,
      } satisfies RichActivity]
    })
  }, [proj, columns, memberById, statusColorById, vc.colorBy])

  // Apply groupBy + sortBy via the same buildRows used by GanttView.
  const rows = useMemo(
    () => buildRows(
      richActivities,
      memberArray,
      vc.groupBy,
      vc.sortBy,
      new Set<string>(),
      new Set<string>(),
      proj?.statuses,
    ),
    [richActivities, memberArray, vc.groupBy, vc.sortBy, proj?.statuses],
  )

  // ── List / Kanban shared lookups ──────────────────────────────────────────

  const apiActivities = useMemo<ApiActivity[]>(
    () => (proj?.activities ?? []).map(a => toApiActivity(a, proj?.timeline.id ?? '')),
    [proj],
  )

  const publicMemberById = useMemo(() => {
    const m = new Map<string, PublicMember>()
    proj?.members.forEach(member => m.set(member.id, member))
    return m
  }, [proj])

  const statusById = useMemo(() => {
    const m = new Map<string, Status>()
    proj?.statuses.forEach(s => m.set(s.id, s))
    return m
  }, [proj])

  const tagById = useMemo(() => {
    const m = new Map<string, Tag>()
    proj?.tags.forEach(t => m.set(t.id, t))
    return m
  }, [proj])

  const activityTitleById = useMemo(() => {
    const m = new Map<string, string>()
    apiActivities.forEach(a => m.set(a.id, a.title))
    return m
  }, [apiActivities])

  // ── List view derived data ────────────────────────────────────────────────

  const listVc = useMemo(
    () => parseListViewConfig(proj?.share.viewConfig ?? '{}'),
    [proj?.share.viewConfig],
  )

  const visibleListColumns = useMemo<ColMeta[]>(() => {
    if (!listVc.columns) return COL_CATALOG.filter(c => c.defaultVisible)
    const byId = new Map(COL_CATALOG.map(c => [c.id, c]))
    return listVc.columns
      .filter(c => c.visible)
      .map(c => byId.get(c.id))
      .filter((c): c is ColMeta => Boolean(c))
  }, [listVc.columns])

  const listRows = useMemo(() => {
    if (!proj || proj.share.viewType !== 'list') return []
    const sorted = sortListActivities(apiActivities, listVc.sortBy)
    return buildListRows(sorted, listVc.groupBy, publicMemberById, statusById, proj.statuses, new Set<string>())
  }, [proj, apiActivities, listVc.groupBy, listVc.sortBy, publicMemberById, statusById])

  // ── Kanban view derived data ──────────────────────────────────────────────

  const kanbanVc = useMemo(
    () => parseKanbanViewConfig(proj?.share.viewConfig ?? '{}'),
    [proj?.share.viewConfig],
  )

  const adaptedMembers = useMemo<TeamMemberWithUser[]>(
    () => (proj?.members ?? []).map(toTeamMemberWithUser),
    [proj],
  )

  const kanbanStatusColorById = useMemo(() => {
    const m = new Map<string, string>()
    proj?.statuses.forEach(s => m.set(s.id, s.color))
    return m
  }, [proj])

  const kanbanColorMap = useMemo(() => {
    const m = new Map<string, string>()
    apiActivities.forEach((a, i) => m.set(a.id, resolveActivityColor(a, i, memberById, kanbanVc.colorBy, kanbanStatusColorById)))
    return m
  }, [apiActivities, memberById, kanbanVc.colorBy, kanbanStatusColorById])

  const kanbanColumnsResolved = useMemo(() => {
    if (!proj || proj.share.viewType !== 'kanban') return []
    return buildColumns(kanbanVc.groupBy, apiActivities, adaptedMembers, proj.statuses, kanbanVc.sortBy)
  }, [proj, kanbanVc.groupBy, kanbanVc.sortBy, apiActivities, adaptedMembers])

  const kanbanHierarchy = useMemo(() => buildHierarchyMaps(apiActivities), [apiActivities])

  const kanbanActivityById = useMemo(() => {
    const m = new Map<string, ApiActivity>()
    apiActivities.forEach(a => m.set(a.id, a))
    return m
  }, [apiActivities])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 10, color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span>Loading shared view…</span>
      </div>
    )
  }

  // A locked share surfaces as a PASSWORD_REQUIRED error until a valid view
  // token is obtained — show the unlock prompt rather than a dead-end error.
  if (isError && (error as ApiError | null)?.code === 'PASSWORD_REQUIRED') {
    return <UnlockPrompt token={token} onUnlocked={setViewToken} />
  }

  if (isError) {
    const apiErr = error as { status?: number } | null
    const is404 = apiErr?.status === 404
    const is410 = apiErr?.status === 410
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: '#374151', fontFamily: 'var(--font-sans)', padding: 24 }}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          {is404 ? 'Share not found' : is410 ? 'This share has expired or been revoked' : 'Could not load this view'}
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, textAlign: 'center' }}>
          {is404 || is410 ? 'The link may have been removed or may never have existed.' : 'Please try again later.'}
        </p>
      </div>
    )
  }

  if (!proj) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#ffffff' }}>
      {/* Branding strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 44,
        background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        color: '#111827',
      }}>
        <Badge
          identity={{ color: proj.timeline.color ?? '#6b7280', icon: proj.timeline.icon ?? '__none__' }}
          name={proj.timeline.name}
          size={24}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{proj.timeline.name}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{proj.teamName}{proj.share.name ? ` · ${proj.share.name}` : ''}</span>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          {proj.activities.length} {proj.activities.length === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      {/* View body — interactive=false for every view type */}
      {proj.share.viewType === 'list' ? (
        <PublicListTable
          rows={listRows}
          visibleColumns={visibleListColumns}
          memberById={publicMemberById}
          statusById={statusById}
          tagById={tagById}
          activityTitleById={activityTitleById}
        />
      ) : proj.share.viewType === 'kanban' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <KanbanBoard
            columns={kanbanColumnsResolved}
            groupBy={kanbanVc.groupBy}
            members={memberArray}
            statusById={statusById}
            tagById={tagById}
            colorMap={kanbanColorMap}
            cardFields={DEFAULT_CARD_FIELDS}
            suppressedFields={new Set()}
            selectedActivityId={null}
            matchedIds={new Set()}
            activeMatchId={null}
            hasQuery={false}
            collapsedColumnIds={new Set()}
            onToggleCollapse={() => {}}
            onCardClick={() => {}}
            onAddInColumn={() => {}}
            onDrop={() => {}}
            activityById={kanbanActivityById}
            activityTitleById={activityTitleById}
            showHierarchy={false}
            childrenByParentId={kanbanHierarchy.childrenByParentId}
            collapsedParents={new Set()}
            onToggleParent={() => {}}
            interactive={false}
          />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <GanttGrid
            rows={rows}
            columns={columns}
            todayIndex={todayIdx}
            selectedActivityId={null}
            onSelectActivity={() => {}}
            resolvedGranularity={resolvedGranularity}
            interactive={false}
          />
        </div>
      )}
    </div>
  )
}
