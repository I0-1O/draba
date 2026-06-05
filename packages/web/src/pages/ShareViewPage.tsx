/**
 * ShareViewPage — public read-only view for a share link.
 *
 * Mounted at /s/:token outside ProtectedRoute. Fetches the ShareProjection
 * from the public gateway, then renders the Gantt (or other view in future
 * phases) in interactive=false mode with the frozen view config applied.
 * Theme is forced to light.
 */

import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useShareProjection } from '@/hooks/useShares'
import GanttGrid, { type GanttRow } from '@/components/gantt/GanttGrid'
import { resolveColorHex } from '@/components/identity/identity-constants'
import { MEMBER_COLORS, ACTIVITY_COLORS } from '@/types'
import {
  generateColumns,
  positionInColumns,
  todayColumnPosition,
  autoFitGranularity,
} from '@/components/gantt/granularity'
import type { components } from '@draba/shared'
import type { GroupBy, SortBy, ColorBy, TimeGranularity } from '@/components/gantt/GanttToolbar'
import type { Member } from '@/types'
import { Share2, AlertCircle, Loader2 } from 'lucide-react'

type PublicActivity = components['schemas']['PublicActivity']
type PublicMember = components['schemas']['PublicMember']
type Status = components['schemas']['Status']

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

// ── Data helpers (mirrors GanttView's toRichActivity logic) ──────────────────

function initialsFrom(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase()
}

function toMember(m: PublicMember, index: number): Member {
  const fallback = MEMBER_COLORS[index % MEMBER_COLORS.length]
  return {
    id: m.id,
    name: m.displayName,
    initials: initialsFrom(m.displayName),
    color: resolveColorHex(m.color) || fallback,
  }
}

// ── ShareViewPage ─────────────────────────────────────────────────────────────

export default function ShareViewPage() {
  const { token } = useParams<{ token: string }>()
  const { data: proj, isLoading, isError, error } = useShareProjection(token)

  // Parse view config from the frozen share config.
  const vc = useMemo(
    () => parseViewConfig(proj?.share.viewConfig ?? '{}'),
    [proj?.share.viewConfig],
  )

  // Build columns for the timeline's date range.
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

  // Build member lookup.
  const memberById = useMemo(() => {
    if (!proj) return {} as Record<string, Member>
    return Object.fromEntries(
      proj.members.map((m, i) => [m.id, toMember(m, i)])
    )
  }, [proj])

  // Build status color lookup.
  const statusColorById = useMemo(() => {
    const m = new Map<string, string>()
    proj?.statuses.forEach((s: Status) => m.set(s.id, s.color))
    return m
  }, [proj])

  // Build GanttRow list from PublicActivity array.
  const rows = useMemo((): GanttRow[] => {
    if (!proj || columns.length === 0) return []
    const viewStart = columns[0].start
    const viewEnd = columns[columns.length - 1].end

    const richActivities = proj.activities.flatMap((a: PublicActivity, i: number) => {
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
      }]
    })

    // Simple unsorted flat list — groupBy is a future enhancement for read-only mode.
    return richActivities.map(ev => ({ kind: 'activity' as const, event: ev }))
  }, [proj, columns, memberById, statusColorById, vc.colorBy])

  // Force light mode for public viewer.
  // The document class is reset on unmount so authenticated users retain their preference.
  useMemo(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 10, color: '#6b7280', fontFamily: 'var(--font-sans)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span>Loading shared view…</span>
      </div>
    )
  }

  if (isError) {
    const apiErr = error as { status?: number; message?: string } | null
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
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 40,
        background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
      }}>
        <Share2 size={14} style={{ color: '#9ca3af' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{proj.timeline.name}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>·</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Shared view</span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>
          {proj.activities.length} {proj.activities.length === 1 ? 'activity' : 'activities'}
        </span>
      </div>

      {/* Gantt grid — interactive=false */}
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
    </div>
  )
}
