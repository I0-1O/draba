/**
 * GanttView — data container for the Gantt grid.
 *
 * Fetches events and members, applies grouping and sorting, builds the
 * GanttRow list, and passes everything to GanttGrid. The component owns
 * no layout state — granularity, groupBy, and sortBy come from DashboardPage.
 *
 * Also owns the find-match computation: it reads the debounced query from
 * FindContext, matches against the fetched API events, and registers the
 * ordered match list back into FindContext so GanttGrid can apply visual
 * treatment and auto-scroll.
 */

import { useMemo, useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react';
import GanttGrid, { type GanttEvent, type GanttRow, type FindState } from './GanttGrid';
import { useTeamEvents, useTeamMembers, useUpdateEvent } from '@/hooks/useTeamEvents';
import type { components } from '@draba/shared';
import { type Member, EVENT_COLORS, MEMBER_COLORS } from '@/types';
import type { GroupBy, SortBy, TimeGranularity, ColorBy } from './GanttToolbar';
import {
  generateColumns,
  positionInColumns,
  todayColumnPosition,
  autoFitGranularity,
  type ColumnDef,
} from './granularity';
import { matchEvents } from '@/lib/findMatcher';
import { useFind } from '@/contexts/FindContext';
import { useFilter } from '@/contexts/FilterContext';

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
  colorBy: ColorBy;
  selectedEventId?: string | null;
  onSelectEvent?: (id: string | null) => void;
  /** Called when the user drags on an empty lane to create an event. */
  onLaneDrag?: (startDate: Date, endDate: Date, memberId: string | null) => void;
  /** Called once members are loaded, so the parent can access them for panels. */
  onMembersLoaded?: (members: Member[]) => void;
  /** Called when an event is selected — passes the full API event object. */
  onSelectApiEvent?: (event: ApiEvent | null) => void;
}

/** Deterministic color from a statusId UUID — replaced by real status colors in Phase 10. */
function statusColorFromId(statusId: string | null | undefined): string {
  if (!statusId) return '#6b7280';
  const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#84cc16'];
  let h = 0;
  for (let i = 0; i < statusId.length; i++) {
    h = statusId.charCodeAt(i) + ((h << 5) - h);
    h |= 0;
  }
  return palette[Math.abs(h) % palette.length];
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
  colorBy: ColorBy,
): RichEvent | null {
  const evStart = new Date(toDateOnly(ev.startAt));
  const evEnd = new Date(toDateOnly(ev.endAt));

  if (evEnd < viewStart || evStart > viewEnd) return null;

  const clampedStart = evStart < viewStart ? viewStart : evStart;
  const clampedEnd = evEnd > viewEnd ? viewEnd : evEnd;

  const { startCol, span } = positionInColumns(clampedStart, clampedEnd, columns);
  const assignedIds = ev.assignedMemberIds ?? [];
  const members = assignedIds.map(id => memberById[id]).filter((m): m is Member => Boolean(m));

  const color =
    colorBy === 'member' ? (members[0]?.color ?? ev.color ?? EVENT_COLORS[index % EVENT_COLORS.length]) :
    colorBy === 'status' ? statusColorFromId((ev as ApiEvent & { statusId?: string | null }).statusId) :
    /* event */ (ev.color ?? EVENT_COLORS[index % EVENT_COLORS.length]);

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
  colorBy,
  selectedEventId = null,
  onSelectEvent = () => {},
  onLaneDrag,
  onMembersLoaded,
  onSelectApiEvent,
}: Props) {
  const updateEvent = useUpdateEvent(teamId);
  const today = todayMidnight();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const { debouncedQuery, registerMatches, activeMatchId, matchedIds, matchReasons } = useFind();
  const { activeFilter } = useFilter();

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

  // Notify parent once the member list resolves.
  useEffect(() => {
    if (onMembersLoaded && members.length > 0) {
      onMembersLoaded(members);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  const rows: GanttRow[] = useMemo(() => {
    const richEvents = apiEvents
      .map((ev, i) => toRichEvent(ev, i, memberById, viewStart, viewEnd, columns, colorBy))
      .filter((e): e is RichEvent => e !== null);
    return buildRows(richEvents, members, groupBy, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiEvents, members, memberById, groupBy, sortBy, colorBy, viewStart, viewEnd, columns]);

  // ── Find: compute matches and register with context ───────────────────────

  const matchResults = useMemo(
    () => matchEvents(debouncedQuery, apiEvents, members, apiEvents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, apiEvents, members],
  );

  const matchedSet = useMemo(
    () => new Set(matchResults.map(r => r.eventId)),
    [matchResults],
  );

  const computedMatchReasons = useMemo(() => {
    const map = new Map<string, string[]>();
    matchResults.forEach(r => map.set(r.eventId, r.reasons));
    return map;
  }, [matchResults]);

  // Ordered match IDs follow the current row order so prev/next walks the
  // visual top-to-bottom sequence rather than the arbitrary API order.
  const orderedMatchIds = useMemo(
    () => rows
      .filter(r => r.kind === 'event' && matchedSet.has(r.event.id))
      .map(r => (r as { kind: 'event'; event: GanttEvent }).event.id),
    [rows, matchedSet],
  );

  useEffect(() => {
    registerMatches(orderedMatchIds, computedMatchReasons);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedMatchIds, computedMatchReasons]);

  // Build the FindState passed to GanttGrid
  const hasQuery = debouncedQuery.trim().length > 0;
  const filtersActive = activeFilter.kind !== 'preset' || activeFilter.id !== 'all';
  const findState: FindState = useMemo(() => ({
    hasQuery,
    matchedIds: matchedSet,
    activeMatchId,
    matchReasons,
    filtersActive,
    matchCount: matchedIds.length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hasQuery, matchedSet, activeMatchId, matchReasons, filtersActive, matchedIds.length]);

  // ── Bar drag ─────────────────────────────────────────────────────────────

  const handleBarDrag = useCallback((eventId: string, newStartDate: Date, newEndDate: Date) => {
    updateEvent.mutate({
      eventId,
      patch: {
        startAt: newStartDate.toISOString(),
        endAt: newEndDate.toISOString(),
      },
    });
  }, [updateEvent]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full text-muted-foreground text-[13px]">
        Loading events…
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
      <GanttGrid
        rows={rows}
        columns={columns}
        todayIndex={todayIdx}
        selectedEventId={selectedEventId}
        findState={findState}
        onSelectEvent={(id) => {
          onSelectEvent(id);
          if (onSelectApiEvent) {
            const found = id ? (apiEvents.find(e => e.id === id) ?? null) : null;
            onSelectApiEvent(found);
          }
        }}
        onLaneDrag={onLaneDrag}
        onBarDrag={handleBarDrag}
        onClearFilters={filtersActive ? () => {} : undefined}
      />
    </div>
  );
}
