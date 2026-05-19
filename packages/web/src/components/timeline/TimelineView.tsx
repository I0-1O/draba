/**
 * TimelineView — data container for TimelineGrid.
 *
 * Fetches events and members, computes the visible date window, maps API
 * types to view-model types (Member, DrabaEvent), and hands everything to
 * the presentational TimelineGrid component.
 */

import { useMemo } from 'react'
import TimelineGrid from './TimelineGrid'
import { useTeamEvents, useTeamMembers } from '@/hooks/useTeamEvents'
import type { components } from '@draba/shared'
import { type Member, type DrabaEvent, EVENT_COLORS, MEMBER_COLORS } from '@/types'

type ApiEvent = components['schemas']['Event']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

interface Props {
  teamId: string
  /** ISO date "YYYY-MM-DD" — defaults to 14 days before today. */
  startDate?: string
  /** ISO date "YYYY-MM-DD" — defaults to 75 days after today. */
  endDate?: string
  selectedEventId?: string | null
  onSelectEvent?: (id: string | null) => void
}

function toDateOnly(datetime: string): string {
  return datetime.slice(0, 10)
}

/** Whole-day count from a to b (b may be before a, returns negative). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function todayMidnight(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** Map a TeamMemberWithUser API object to the local Member view-model. */
function toMember(m: TeamMemberWithUser, index: number): Member {
  const name = m.displayName || m.email || 'Unknown'
  return {
    id: m.id,
    name,
    initials: initials(name),
    color: m.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length],
  }
}

/**
 * Convert one API event to DrabaEvent view-model entries — one per assigned
 * member so the event block appears in each assignee's lane.
 */
function toEventBlocks(
  ev: ApiEvent,
  index: number,
  viewStart: Date,
  viewEnd: Date,
): DrabaEvent[] {
  const evStart = new Date(toDateOnly(ev.startAt))
  const evEnd = new Date(toDateOnly(ev.endAt))

  // Drop events that fall entirely outside the visible window.
  if (evEnd < viewStart || evStart > viewEnd) return []

  const clampedStart = evStart < viewStart ? viewStart : evStart
  const clampedEnd = evEnd > viewEnd ? viewEnd : evEnd

  const startCol = daysBetween(viewStart, clampedStart)
  const span = Math.max(1, daysBetween(clampedStart, clampedEnd) + 1)
  const color = ev.color ?? EVENT_COLORS[index % EVENT_COLORS.length]
  const assignedIds = ev.assignedMemberIds ?? []

  if (assignedIds.length === 0) return []

  return assignedIds.map(memberId => ({
    id: `${ev.id}:${memberId}`,
    title: ev.title,
    memberId,
    startDate: toDateOnly(ev.startAt),
    endDate: toDateOnly(ev.endAt),
    startCol,
    span,
    color,
    // Status resolution requires team_statuses (Phase 10); use 'planned' for now.
    status: 'planned' as const,
  }))
}

export default function TimelineView({
  teamId,
  startDate,
  endDate,
  selectedEventId = null,
  onSelectEvent = () => {},
}: Props) {
  const today = todayMidnight()

  const viewStart = useMemo<Date>(() => {
    if (startDate) return new Date(startDate)
    const d = new Date(today)
    d.setDate(d.getDate() - 14)
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate])

  const viewEnd = useMemo<Date>(() => {
    if (endDate) return new Date(endDate)
    const d = new Date(today)
    d.setDate(d.getDate() + 75)
    return d
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDate])

  const { days, todayIndex } = useMemo(() => {
    const labels: string[] = []
    let todayIdx = -1
    const todayStr = today.toISOString().slice(0, 10)
    const cur = new Date(viewStart)
    while (cur <= viewEnd) {
      labels.push(formatDayLabel(cur))
      if (cur.toISOString().slice(0, 10) === todayStr) todayIdx = labels.length - 1
      cur.setDate(cur.getDate() + 1)
    }
    return { days: labels, todayIndex: todayIdx }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStart, viewEnd])

  const from = viewStart.toISOString()
  const to = viewEnd.toISOString()

  const { data: apiMembers = [] } = useTeamMembers(teamId)
  const { data: apiEvents = [], isLoading } = useTeamEvents(teamId, from, to)

  const members: Member[] = useMemo(
    () => apiMembers.map((m, i) => toMember(m, i)),
    [apiMembers],
  )

  const events: DrabaEvent[] = useMemo(
    () => apiEvents.flatMap((ev, i) => toEventBlocks(ev, i, viewStart, viewEnd)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiEvents, viewStart, viewEnd],
  )

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--muted-foreground)',
          fontSize: 13,
          fontFamily: 'var(--font-sans)',
        }}
      >
        Loading timeline…
      </div>
    )
  }

  return (
    <TimelineGrid
      members={members}
      events={events}
      days={days}
      todayIndex={todayIndex}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
    />
  )
}
