/**
 * GanttView — data container for the Gantt grid.
 *
 * Fetches events and members, applies grouping and sorting, builds the
 * GanttRow list, and passes everything to GanttGrid. The component owns
 * no layout state — granularity, groupBy, and sortBy come from DashboardPage.
 */

import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import GanttGrid, { type GanttEvent, type GanttRow } from './GanttGrid';
import { useTeamEvents, useTeamMembers } from '@/hooks/useTeamEvents';
import type { components } from '@draba/shared';
import { type Member, EVENT_COLORS, MEMBER_COLORS } from '@/types';
import type { GroupBy, SortBy, TimeGranularity } from './GanttToolbar';
import {
  generateColumns,
  positionInColumns,
  todayColumnPosition,
  autoFitGranularity,
  type ColumnDef,
} from './granularity';

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
  granularity: TimeGranularity | 'auto';
  selectedEventId?: string | null;
  onSelectEvent?: (id: string | null) => void;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function toDateOnly(datetime: string): string {
  return datetime.slice(0, 10);
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
  columns: ColumnDef[],
): RichEvent | null {
  const evStart = new Date(toDateOnly(ev.startAt));
  const evEnd = new Date(toDateOnly(ev.endAt));

  if (evEnd < viewStart || evStart > viewEnd) return null;

  const clampedStart = evStart < viewStart ? viewStart : evStart;
  const clampedEnd = evEnd > viewEnd ? viewEnd : evEnd;

  const { startCol, span } = positionInColumns(clampedStart, clampedEnd, columns);
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
    return a.startAtMs - b.startAtMs;
  });
}

// ── Grouping ─────────────────────────────────────────────────────────────────

function buildRows(
  events: RichEvent[],
  members: Member[],
  groupBy: GroupBy,
  sortBy: SortBy,
): GanttRow[] {
  const sorted = sortEvents(events, sortBy);

  if (groupBy === 'none') {
    return sorted.map(ev => ({ kind: 'event' as const, event: ev }));
  }

  if (groupBy === 'member') {
    const buckets: Record<string, RichEvent[]> = {};
    for (const ev of sorted) {
      const key = ev.primaryMemberId ?? '__none__';
      (buckets[key] ??= []).push(ev);
    }

    const rows: GanttRow[] = [];
    for (const m of members) {
      const evs = buckets[m.id];
      if (!evs?.length) continue;
      rows.push({ kind: 'group', id: m.id, label: m.name, color: m.color, count: evs.length });
      for (const ev of evs) rows.push({ kind: 'event', event: { ...ev, isChild: false } });
    }
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

      for (const child of sorted) {
        if (child.parentEventId === ev.id) {
          placed.add(child.id);
          rows.push({ kind: 'event', event: { ...child, isChild: true } });
        }
      }
    }

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

export default function GanttView({
  teamId,
  startDate,
  endDate,
  groupBy,
  sortBy,
  granularity,
  selectedEventId = null,
  onSelectEvent = () => {},
}: Props) {
  const today = todayMidnight();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth || 800);
    return () => ro.disconnect();
  }, []);

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

  const resolvedGranularity = useMemo<TimeGranularity>(() => {
    if (granularity !== 'auto') return granularity;
    return autoFitGranularity(viewStart, viewEnd, containerWidth);
  }, [granularity, viewStart, viewEnd, containerWidth]);

  const columns = useMemo(
    () => generateColumns(viewStart, viewEnd, resolvedGranularity),
    [viewStart, viewEnd, resolvedGranularity],
  );

  const todayIdx = useMemo(
    () => todayColumnPosition(columns),
    [columns],
  );

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
      .map((ev, i) => toRichEvent(ev, i, memberById, viewStart, viewEnd, columns))
      .filter((e): e is RichEvent => e !== null);
    return buildRows(richEvents, members, groupBy, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEvents, members, memberById, groupBy, sortBy, viewStart, viewEnd, columns]);

  if (isLoading) {
    return (
      <div
        ref={containerRef}
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
        Loading events…
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <GanttGrid
        rows={rows}
        columns={columns}
        todayIndex={todayIdx}
        selectedEventId={selectedEventId}
        onSelectEvent={onSelectEvent}
      />
    </div>
  );
}
