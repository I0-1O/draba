/**
 * TimelineView — data container for the Gantt grid.
 *
 * Fetches events and members, applies grouping and sorting, builds the
 * GanttRow list, and passes everything to TimelineGrid. The component owns
 * no layout state — zoom, groupBy, and sortBy come from DashboardPage.
 */

import { useMemo } from 'react';
import TimelineGrid, { type GanttEvent, type GanttRow } from './TimelineGrid';
import { useTeamEvents, useTeamMembers } from '@/hooks/useTeamEvents';
import type { components } from '@draba/shared';
import { type Member, EVENT_COLORS, MEMBER_COLORS } from '@/types';
import type { GroupBy, SortBy } from './TimelineToolbar';

type ApiEvent = components['schemas']['Event'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

interface Props {
  teamId: string;
  /** ISO date "YYYY-MM-DD" — defaults to 14 days before today. */
  startDate?: string;
  /** ISO date "YYYY-MM-DD" — defaults to 75 days after today. */
  endDate?: string;
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Pixel width of each day column (zoom level). */
  colWidth: number;
  selectedEventId?: string | null;
  onSelectEvent?: (id: string | null) => void;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function toDateOnly(datetime: string): string {
  return datetime.slice(0, 10);
}

/** Whole-day count from a to b. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ── Type mapping ─────────────────────────────────────────────────────────────

function toMember(m: TeamMemberWithUser, index: number): Member {
  const name = m.displayName || m.email || 'Unknown';
  return {
    id: m.id,
    name,
    initials: initialsFrom(name),
    color: m.color ?? MEMBER_COLORS[index % MEMBER_COLORS.length],
  };
}

/** Intermediate type that carries original API fields alongside view-state. */
interface RichEvent extends GanttEvent {
  startAtMs: number;
  endAtMs: number;
  parentEventId: string | null;
  primaryMemberId: string | null;
  assignedMemberIds: string[];
}

function toRichEvent(
  ev: ApiEvent,
  index: number,
  memberById: Record<string, Member>,
  viewStart: Date,
  viewEnd: Date,
): RichEvent | null {
  const evStart = new Date(toDateOnly(ev.startAt));
  const evEnd = new Date(toDateOnly(ev.endAt));

  if (evEnd < viewStart || evStart > viewEnd) return null;

  const clampedStart = evStart < viewStart ? viewStart : evStart;
  const clampedEnd = evEnd > viewEnd ? viewEnd : evEnd;

  const startCol = daysBetween(viewStart, clampedStart);
  const span = Math.max(1, daysBetween(clampedStart, clampedEnd) + 1);
  const color = ev.color ?? EVENT_COLORS[index % EVENT_COLORS.length];
  const assignedIds = ev.assignedMemberIds ?? [];
  const members = assignedIds.map(id => memberById[id]).filter((m): m is Member => Boolean(m));

  return {
    id: ev.id,
    title: ev.title,
    startCol,
    span,
    color,
    members,
    isChild: Boolean(ev.parentEventId),
    startAtMs: new Date(ev.startAt).getTime(),
    endAtMs: new Date(ev.endAt).getTime(),
    parentEventId: ev.parentEventId ?? null,
    primaryMemberId: members[0]?.id ?? null,
    assignedMemberIds: assignedIds,
  };
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function sortEvents(events: RichEvent[], sortBy: SortBy): RichEvent[] {
  return [...events].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'endDate') return a.endAtMs - b.endAtMs;
    return a.startAtMs - b.startAtMs; // startDate (default)
  });
}

// ── Grouping ─────────────────────────────────────────────────────────────────

function buildRows(
  events: RichEvent[],
  members: Member[],
  memberById: Record<string, Member>,
  groupBy: GroupBy,
  sortBy: SortBy,
): GanttRow[] {
  const sorted = sortEvents(events, sortBy);

  if (groupBy === 'none') {
    return sorted.map(ev => ({ kind: 'event' as const, event: ev }));
  }

  if (groupBy === 'member') {
    // Bucket events by primary member (first assignee); unassigned → '__none__'
    const buckets: Record<string, RichEvent[]> = {};
    for (const ev of sorted) {
      const key = ev.primaryMemberId ?? '__none__';
      (buckets[key] ??= []).push(ev);
    }

    const rows: GanttRow[] = [];
    // Iterate members in team order so the sections match the sidebar
    for (const m of members) {
      const evs = buckets[m.id];
      if (!evs?.length) continue;
      rows.push({ kind: 'group', id: m.id, label: m.name, color: m.color, count: evs.length });
      for (const ev of evs) rows.push({ kind: 'event', event: { ...ev, isChild: false } });
    }
    // Unassigned section
    const unassigned = buckets['__none__'];
    if (unassigned?.length) {
      rows.push({ kind: 'group', id: '__none__', label: 'Unassigned', color: 'var(--muted-foreground)', count: unassigned.length });
      for (const ev of unassigned) rows.push({ kind: 'event', event: { ...ev, isChild: false } });
    }
    return rows;
  }

  if (groupBy === 'parent') {
    const placed = new Set<string>();
    const rows: GanttRow[] = [];

    for (const ev of sorted) {
      if (placed.has(ev.id) || ev.parentEventId) continue;
      placed.add(ev.id);
      rows.push({ kind: 'event', event: { ...ev, isChild: false } });

      // Inline children directly after their parent
      for (const child of sorted) {
        if (child.parentEventId === ev.id) {
          placed.add(child.id);
          rows.push({ kind: 'event', event: { ...child, isChild: true } });
        }
      }
    }

    // Orphaned children (parent outside visible range or not in results)
    for (const ev of sorted) {
      if (!placed.has(ev.id)) {
        rows.push({ kind: 'event', event: { ...ev, isChild: true } });
      }
    }

    return rows;
  }

  return sorted.map(ev => ({ kind: 'event' as const, event: ev }));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TimelineView({
  teamId,
  startDate,
  endDate,
  groupBy,
  sortBy,
  colWidth,
  selectedEventId = null,
  onSelectEvent = () => {},
}: Props) {
  const today = todayMidnight();

  const viewStart = useMemo<Date>(() => {
    if (startDate) return new Date(startDate);
    const d = new Date(today);
    d.setDate(d.getDate() - 14);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const viewEnd = useMemo<Date>(() => {
    if (endDate) return new Date(endDate);
    const d = new Date(today);
    d.setDate(d.getDate() + 75);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDate]);

  // Day labels and today index
  const { days, todayIndex } = useMemo(() => {
    const labels: string[] = [];
    let todayIdx = -1;
    const todayStr = today.toISOString().slice(0, 10);
    const cur = new Date(viewStart);
    while (cur <= viewEnd) {
      labels.push(formatDayLabel(cur));
      if (cur.toISOString().slice(0, 10) === todayStr) todayIdx = labels.length - 1;
      cur.setDate(cur.getDate() + 1);
    }
    return { days: labels, todayIndex: todayIdx };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStart, viewEnd]);

  const from = viewStart.toISOString();
  const to = viewEnd.toISOString();

  const { data: apiMembers = [] } = useTeamMembers(teamId);
  const { data: apiEvents = [], isLoading } = useTeamEvents(teamId, from, to);

  const members: Member[] = useMemo(
    () => apiMembers.map((m, i) => toMember(m, i)),
    [apiMembers],
  );

  const memberById = useMemo<Record<string, Member>>(() => {
    const map: Record<string, Member> = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  const rows: GanttRow[] = useMemo(() => {
    const richEvents = apiEvents
      .map((ev, i) => toRichEvent(ev, i, memberById, viewStart, viewEnd))
      .filter((e): e is RichEvent => e !== null);
    return buildRows(richEvents, members, memberById, groupBy, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEvents, members, memberById, groupBy, sortBy, viewStart, viewEnd]);

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
    );
  }

  return (
    <TimelineGrid
      rows={rows}
      days={days}
      todayIndex={todayIndex}
      colWidth={colWidth}
      selectedEventId={selectedEventId}
      onSelectEvent={onSelectEvent}
    />
  );
}
