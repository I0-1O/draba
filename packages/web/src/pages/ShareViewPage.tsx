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
