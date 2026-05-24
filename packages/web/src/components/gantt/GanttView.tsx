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
import GanttGrid, { type GanttActivity, type GanttRow, type FindState } from './GanttGrid';
import { useTeamActivities, useTeamMembers, useUpdateActivity } from '@/hooks/useTeamActivities';
import type { components } from '@draba/shared';
import { type Member, ACTIVITY_COLORS, MEMBER_COLORS } from '@/types';
import { resolveColorHex } from '@/components/identity/identity-constants';
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

type ApiActivity = components['schemas']['Activity'];
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
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  /** Called when the user drags on an empty lane to create an activity. */
  onLaneDrag?: (startDate: Date, endDate: Date, memberId: string | null) => void;
  /** Called once members are loaded, so the parent can access them for panels. */
  onMembersLoaded?: (members: Member[]) => void;
  /** Called when an activity is selected — passes the full API activity object. */
  onSelectApiActivity?: (activity: ApiActivity | null) => void;
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
  // colorId: prefer API colorId; fall back to palette slot.
  const colorId = m.color ?? null;
  const fallbackHex = MEMBER_COLORS[index % MEMBER_COLORS.length];
  return {
    id: m.id,
    name,
    initials: initialsFrom(name),
    colorId: colorId ?? undefined,
    color: colorId ? resolveColorHex(colorId) : fallbackHex,
  };
}

/** Intermediate type that carries original API fields alongside view-state. */
interface RichActivity extends GanttActivity {
  startAtMs: number;
  endAtMs: number;
  parentActivityId: string | null;
  primaryMemberId: string | null;
  assignedMemberIds: string[];
}

function toRichActivity(
  ev: ApiActivity,
  index: number,
  memberById: Record<string, Member>,
  viewStart: Date,
  viewEnd: Date,
  columns: ColumnDef[],
  colorBy: ColorBy,
): RichActivity | null {
  const evStart = new Date(toDateOnly(ev.startAt));
  const evEnd = new Date(toDateOnly(ev.endAt));

  if (evEnd < viewStart || evStart > viewEnd) return null;

  const clampedStart = evStart < viewStart ? viewStart : evStart;
  const clampedEnd = evEnd > viewEnd ? viewEnd : evEnd;

  const { startCol, span } = positionInColumns(clampedStart, clampedEnd, columns);
  const assignedIds = ev.assignedMemberIds ?? [];
  const members = assignedIds.map(id => memberById[id]).filter((m): m is Member => Boolean(m));

  const color =
    colorBy === 'member' ? (members[0]?.color ?? ev.color ?? ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]) :
    colorBy === 'status' ? statusColorFromId((ev as ApiActivity & { statusId?: string | null }).statusId) :
    /* activity */ (ev.color ?? ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]);

  return {
    id: ev.id,
    title: ev.title,
    startCol,
    span,
    color,
    iconId: ev.icon ?? undefined,
    members,
    isChild: Boolean(ev.parentActivityId),
    startAtMs: new Date(ev.startAt).getTime(),
    endAtMs: new Date(ev.endAt).getTime(),
    parentActivityId: ev.parentActivityId ?? null,
    primaryMemberId: members[0]?.id ?? null,
    assignedMemberIds: assignedIds,
  };
}

// ── Sorting ──────────────────────────────────────────────────────────────────

function sortActivities(activities: RichActivity[], sortBy: SortBy): RichActivity[] {
  return [...activities].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'endDate') return a.endAtMs - b.endAtMs;
    return a.startAtMs - b.startAtMs;
  });
}

// ── Grouping ─────────────────────────────────────────────────────────────────

function buildRows(
  activities: RichActivity[],
  members: Member[],
  groupBy: GroupBy,
  sortBy: SortBy,
): GanttRow[] {
  const sorted = sortActivities(activities, sortBy);

  if (groupBy === 'none') {
    return sorted.map(ev => ({ kind: 'activity' as const, event: ev }));
  }

  if (groupBy === 'member') {
    const buckets: Record<string, RichActivity[]> = {};
    for (const ev of sorted) {
      const key = ev.primaryMemberId ?? '__none__';
      (buckets[key] ??= []).push(ev);
    }

    const rows: GanttRow[] = [];
    for (const m of members) {
      const evs = buckets[m.id];
      if (!evs?.length) continue;
      rows.push({ kind: 'group', id: m.id, label: m.name, color: m.color, count: evs.length });
      for (const ev of evs) rows.push({ kind: 'activity', event: { ...ev, isChild: false } });
    }
    const unassigned = buckets['__none__'];
    if (unassigned?.length) {
      rows.push({ kind: 'group', id: '__none__', label: 'Unassigned', color: 'var(--muted-foreground)', count: unassigned.length });
      for (const ev of unassigned) rows.push({ kind: 'activity', event: { ...ev, isChild: false } });
    }
    return rows;
  }

  if (groupBy === 'parent') {
    const placed = new Set<string>();
    const rows: GanttRow[] = [];

    for (const ev of sorted) {
      if (placed.has(ev.id) || ev.parentActivityId) continue;
      placed.add(ev.id);
      rows.push({ kind: 'activity', event: { ...ev, isChild: false } });

      for (const child of sorted) {
        if (child.parentActivityId === ev.id) {
          placed.add(child.id);
          rows.push({ kind: 'activity', event: { ...child, isChild: true } });
        }
      }
    }

    for (const ev of sorted) {
      if (!placed.has(ev.id)) {
        rows.push({ kind: 'activity', event: { ...ev, isChild: true } });
      }
    }

    return rows;
  }

  return sorted.map(ev => ({ kind: 'activity' as const, event: ev }));
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
  selectedActivityId = null,
  onSelectActivity = () => {},
  onLaneDrag,
  onMembersLoaded,
  onSelectApiActivity,
}: Props) {
  const updateActivity = useUpdateActivity(teamId);
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
  const { data: apiActivities = [], isLoading } = useTeamActivities(teamId, from, to);

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
    const richActivities = apiActivities
      .map((ev, i) => toRichActivity(ev, i, memberById, viewStart, viewEnd, columns, colorBy))
      .filter((a): a is RichActivity => a !== null);
    return buildRows(richActivities, members, groupBy, sortBy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiActivities, members, memberById, groupBy, sortBy, colorBy, viewStart, viewEnd, columns]);

  // ── Find: compute matches and register with context ───────────────────────

  const matchResults = useMemo(
    () => matchEvents(debouncedQuery, apiActivities, members, apiActivities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, apiActivities, members],
  );

  const matchedSet = useMemo(
    () => new Set(matchResults.map(r => r.activityId)),
    [matchResults],
  );

  const computedMatchReasons = useMemo(() => {
    const map = new Map<string, string[]>();
    matchResults.forEach(r => map.set(r.activityId, r.reasons));
    return map;
  }, [matchResults]);

  // Ordered match IDs follow the current row order so prev/next walks the
  // visual top-to-bottom sequence rather than the arbitrary API order.
  const orderedMatchIds = useMemo(
    () => rows
      .filter(r => r.kind === 'activity' && matchedSet.has(r.event.id))
      .map(r => (r as { kind: 'activity'; event: GanttActivity }).event.id),
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

  const handleBarDrag = useCallback((activityId: string, newStartDate: Date, newEndDate: Date) => {
    updateActivity.mutate({
      activityId,
      patch: {
        startAt: newStartDate.toISOString(),
        endAt: newEndDate.toISOString(),
      },
    });
  }, [updateActivity]);

  if (isLoading) {
    return (
      <div ref={containerRef} className="flex items-center justify-center h-full text-muted-foreground text-[13px]">
        Loading activities…
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
      <GanttGrid
        rows={rows}
        columns={columns}
        todayIndex={todayIdx}
        selectedActivityId={selectedActivityId}
        findState={findState}
        onSelectActivity={(id) => {
          onSelectActivity(id);
          if (onSelectApiActivity) {
            const found = id ? (apiActivities.find(a => a.id === id) ?? null) : null;
            onSelectApiActivity(found);
          }
        }}
        onLaneDrag={onLaneDrag}
        onBarDrag={handleBarDrag}
        onClearFilters={filtersActive ? () => {} : undefined}
      />
    </div>
  );
}
