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
import { useQueryClient } from '@tanstack/react-query';
import GanttGrid, { type GanttActivity, type GanttRow, type FindState } from './GanttGrid';
import { useTimelineActivities, useTeamMembers, useUpdateActivity } from '@/hooks/useTeamActivities';
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
import { memberComboKey, orderedComboIds, memberComboLabel, comboSortComparator, UNASSIGNED_KEY, SEP } from '@/lib/memberGroups';
import { useFind } from '@/contexts/FindContext';
import { useFilter } from '@/contexts/FilterContext';
import { usePreferenceMap } from '@/hooks/usePreferences';
import { applyActiveFilter } from '@/lib/presetFilters';

type ApiActivity = components['schemas']['Activity'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];
type Status = components['schemas']['Status'];
type SavedFilter = components['schemas']['SavedFilter'];
type Tag = components['schemas']['Tag'];

interface Props {
  teamId: string;
  /** Active timeline ID — activities are fetched scoped to this timeline. */
  timelineId: string;
  /** ISO date "YYYY-MM-DD" — defaults to 14 days before today. */
  startDate?: string;
  /** ISO date "YYYY-MM-DD" — defaults to 75 days after today. */
  endDate?: string;
  groupBy: GroupBy;
  sortBy: SortBy;
  granularity: TimeGranularity | 'auto';
  colorBy: ColorBy;
  /**
   * Timeline statuses — used to derive closedStatusIds and resolve status names
   * in the filter engine. Replaces the old closedStatusIds prop.
   */
  timelineStatuses?: Status[];
  /** Saved filters for the active team — evaluated by the filter engine. */
  savedFilters?: SavedFilter[];
  /** Team tags — used to resolve tag names in the filter engine. */
  tags?: Tag[];
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  /** Called when the user drags on an empty lane to create an activity. */
  onLaneDrag?: (startDate: Date, endDate: Date, memberId: string | null) => void;
  /** Called during a bar drag with live snapped dates — for sidebar preview. */
  onBarDragProgress?: (activityId: string, newStart: Date, newEnd: Date) => void;
  /** Called when a bar drag completes (before the PATCH fires). */
  onBarDragEnd?: () => void;
  /** Called once members are loaded, so the parent can access them for panels. */
  onMembersLoaded?: (members: Member[]) => void;
  /** Called when an activity is selected — passes the full API activity object. */
  onSelectApiActivity?: (activity: ApiActivity | null) => void;
  /** Label column width in px — passed through to GanttGrid for controlled persistence. */
  labelColW?: number;
  /** Called when the user drags the label column resize handle. */
  onLabelColWChange?: (w: number) => void;
  /**
   * When false, all click and drag interactions are suppressed — bars, lane
   * drags, and group toggles are inert. Used by the public share viewer.
   * Default: true.
   */
  interactive?: boolean;
}


// ── Date helpers ────────────────────────────────────────────────────────────

function toDateOnly(datetime: string): string {
  return datetime.slice(0, 10);
}

function todayMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0); // UTC midnight so it aligns with UTC-stored activity dates
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
  const fallbackHex = MEMBER_COLORS[index % MEMBER_COLORS.length];
  return {
    id: m.id,
    name,
    initials: initialsFrom(name),
    color: resolveColorHex(m.color) || fallbackHex,
  };
}

/** Intermediate type that carries original API fields alongside view-state. */
export interface RichActivity extends GanttActivity {
  startAtMs: number;
  endAtMs: number;
  parentActivityId: string | null;
  primaryMemberId: string | null;
  assignedMemberIds: string[];
  statusId: string | null;
}

function toRichActivity(
  ev: ApiActivity,
  index: number,
  memberById: Record<string, Member>,
  viewStart: Date,
  viewEnd: Date,
  columns: ColumnDef[],
  colorBy: ColorBy,
  statusColorById: Map<string, string>,
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
    colorBy === 'status' ? (statusColorById.get((ev as ApiActivity & { statusId?: string | null }).statusId ?? '') ?? '#6b7280') :
    /* activity */ (ev.color ?? ACTIVITY_COLORS[index % ACTIVITY_COLORS.length]);

  return {
    id: ev.id,
    title: ev.title,
    startCol,
    span,
    color,
    icon: ev.icon ?? undefined,
    members,
    isChild: Boolean(ev.parentActivityId),
    startAtMs: new Date(ev.startAt).getTime(),
    endAtMs: new Date(ev.endAt).getTime(),
    parentActivityId: ev.parentActivityId ?? null,
    primaryMemberId: members[0]?.id ?? null,
    assignedMemberIds: assignedIds,
    statusId: (ev as ApiActivity & { statusId?: string | null }).statusId ?? null,
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

/**
 * Builds the flat GanttRow list from positioned activities, applying grouping,
 * sorting, parent→child nesting (arbitrary depth), and collapse state.
 * Exported for unit testing of the tree/collapse logic.
 */
export function buildRows(
  activities: RichActivity[],
  members: Member[],
  groupBy: GroupBy,
  sortBy: SortBy,
  collapsedParents: Set<string>,
  collapsedGroups: Set<string>,
  statuses?: Status[],
): GanttRow[] {
  const sorted = sortActivities(activities, sortBy);

  if (groupBy === 'none') {
    // Flat list — no parent nesting, so children are not indented.
    return sorted.map(ev => ({ kind: 'activity' as const, event: { ...ev, isChild: false, depth: 0 } }));
  }

  if (groupBy === 'member') {
    const memberOrder = members.map(m => m.id);
    const nameById = new Map(members.map(m => [m.id, m.name]));
    // Colors here are already resolved hex (from the Member type / toMember conversion).
    // ListView applies resolveColorHex on the raw API color string instead — both
    // produce hex, but the resolution step happens at different layers.
    const colorById = new Map(members.map(m => [m.id, m.color]));

    const buckets = new Map<string, RichActivity[]>();
    for (const ev of sorted) {
      const key = memberComboKey(ev.assignedMemberIds);
      const list = buckets.get(key) ?? [];
      list.push(ev);
      buckets.set(key, list);
    }

    const comparator = comboSortComparator(memberOrder);
    const sortedKeys = [...buckets.keys()].sort(comparator);

    const rows: GanttRow[] = [];
    for (const key of sortedKeys) {
      const evs = buckets.get(key)!;
      const rawIds = key === UNASSIGNED_KEY ? [] : key.split(SEP);
      const orderedIds = orderedComboIds(rawIds, memberOrder);
      const label = key === UNASSIGNED_KEY ? 'Unassigned' : memberComboLabel(orderedIds, nameById);
      const memberColors = orderedIds.map(id => colorById.get(id) ?? 'var(--muted-foreground)');
      const primaryColor = key === UNASSIGNED_KEY ? 'var(--muted-foreground)' : (memberColors[0] ?? 'var(--muted-foreground)');
      const collapsed = collapsedGroups.has(key);
      rows.push({ kind: 'group', id: key, label, color: primaryColor, memberColors, count: evs.length, collapsed });
      if (collapsed) continue;
      for (const ev of evs) rows.push({ kind: 'activity', event: { ...ev, isChild: false, depth: 0 } });
    }
    return rows;
  }

  if (groupBy === 'parent') {
    // Build a parent→children index, then emit rows via depth-first traversal so
    // grandchildren (and deeper) nest correctly. An activity is a "root" when it
    // has no parent or its parent fell outside the current view.
    const byId = new Map(sorted.map(a => [a.id, a]));
    const childrenByParent = new Map<string, RichActivity[]>();
    const roots: RichActivity[] = [];
    for (const ev of sorted) {
      const pid = ev.parentActivityId;
      if (pid && byId.has(pid)) {
        const list = childrenByParent.get(pid) ?? [];
        list.push(ev);
        childrenByParent.set(pid, list);
      } else {
        roots.push(ev);
      }
    }

    const rows: GanttRow[] = [];
    const seen = new Set<string>();   // emitted into rows (also guards cycles)
    const hidden = new Set<string>(); // suppressed under a collapsed ancestor

    // Recursively mark a collapsed node's descendants as hidden so the leftover
    // sweep below doesn't resurrect them. The `hidden` guard also stops cycles.
    const markHidden = (ev: RichActivity) => {
      if (hidden.has(ev.id)) return;
      hidden.add(ev.id);
      for (const k of childrenByParent.get(ev.id) ?? []) markHidden(k);
    };

    const visit = (ev: RichActivity, depth: number) => {
      if (seen.has(ev.id)) return;
      seen.add(ev.id);
      const kids = childrenByParent.get(ev.id) ?? [];
      const hasChildren = kids.length > 0;
      const collapsed = collapsedParents.has(ev.id);
      rows.push({
        kind: 'activity',
        event: { ...ev, isChild: depth > 0, depth, hasChildren, collapsed },
      });
      if (!hasChildren) return;
      if (collapsed) for (const k of kids) markHidden(k);
      else for (const k of kids) visit(k, depth + 1);
    };

    for (const r of roots) visit(r, 0);
    // Safety net: emit any activity unreachable from a root (e.g. a parent-
    // pointer cycle where no node qualifies as a root) at depth 0, but never
    // resurrect a node intentionally hidden under a collapsed ancestor.
    for (const ev of sorted) {
      if (!seen.has(ev.id) && !hidden.has(ev.id)) visit(ev, 0);
    }
    return rows;
  }

  if (groupBy === 'status') {
    const buckets = new Map<string, RichActivity[]>();
    for (const ev of sorted) {
      const key = ev.statusId ?? '__no_status__';
      const list = buckets.get(key) ?? [];
      list.push(ev);
      buckets.set(key, list);
    }

    const rows: GanttRow[] = [];
    const pushStatusBucket = (id: string, label: string, color: string, evs: RichActivity[]) => {
      const collapsed = collapsedGroups.has(id);
      rows.push({ kind: 'group', id, label, color, count: evs.length, collapsed });
      if (collapsed) return;
      for (const ev of evs) rows.push({ kind: 'activity', event: { ...ev, isChild: false, depth: 0 } });
    };

    if (statuses) {
      for (const s of statuses) {
        const evs = buckets.get(s.id);
        if (!evs?.length) continue;
        pushStatusBucket(s.id, s.name, resolveColorHex(s.color ?? null) ?? 'var(--muted-foreground)', evs);
      }
    }
    const noStatus = buckets.get('__no_status__');
    if (noStatus?.length) {
      pushStatusBucket('__no_status__', 'No status', 'var(--muted-foreground)', noStatus);
    }
    return rows;
  }

  return sorted.map(ev => ({ kind: 'activity' as const, event: ev }));
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Returns only the activities whose status is not in closedStatusIds.
 * Extracted as a named export so the 'open' filter preset logic can be
 * unit-tested without mounting the full component.
 */
export function filterOpenActivities<T extends { statusId?: string | null | undefined }>(
  activities: T[],
  closedStatusIds: Set<string>,
): T[] {
  return activities.filter(a => !a.statusId || !closedStatusIds.has(a.statusId))
}

export default function GanttView({
  teamId,
  timelineId,
  startDate,
  endDate,
  groupBy,
  sortBy,
  granularity,
  colorBy,
  timelineStatuses,
  savedFilters,
  tags,
  selectedActivityId = null,
  onSelectActivity = () => {},
  onLaneDrag,
  onBarDragProgress,
  onBarDragEnd,
  onMembersLoaded,
  onSelectApiActivity,
  labelColW,
  onLabelColWChange,
  interactive = true,
}: Props) {
  const queryClient = useQueryClient();
  const updateActivity = useUpdateActivity(timelineId);
  const today = todayMidnight();

  // Collapse state for the Gantt tree. `collapsedParents` hides an activity's
  // child subtree (parent grouping); `collapsedGroups` hides a member bucket's
  // activities (member grouping). Both persist across re-renders and view tweaks.
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleParent = useCallback((id: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  const { debouncedQuery, registerMatches, activeMatchId, matchedIds, matchReasons } = useFind();
  const { activeFilter } = useFilter();

  const globalPrefs = usePreferenceMap();
  const prefWeekStart = (globalPrefs['week_start'] as string | undefined) === 'sunday' ? 'sunday' : 'monday';
  // Map the stored date_format preference to a BCP 47 locale for Gantt column labels.
  // DD/MM/YYYY users prefer day-first ordering (en-GB: "5 Jan"); all others get MM-first (en-US: "Jan 5").
  const prefDateFormat = (globalPrefs['date_format'] as string | undefined) ?? 'MMM D, YYYY';
  const prefLocale = prefDateFormat === 'DD/MM/YYYY' ? 'en-GB' : 'en-US';

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
    d.setUTCDate(d.getUTCDate() - 14);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate]);

  const viewEnd = useMemo<Date>(() => {
    if (endDate) return new Date(endDate);
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 75);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endDate]);

  const resolvedGranularity = useMemo<TimeGranularity>(() => {
    if (granularity !== 'auto') return granularity;
    return autoFitGranularity(viewStart, viewEnd, containerWidth);
  }, [granularity, viewStart, viewEnd, containerWidth]);

  const columns = useMemo(
    () => generateColumns(viewStart, viewEnd, resolvedGranularity, { weekStart: prefWeekStart, locale: prefLocale }),
    [viewStart, viewEnd, resolvedGranularity, prefWeekStart, prefLocale],
  );

  const todayIdx = useMemo(
    () => todayColumnPosition(columns),
    [columns],
  );

  const from = viewStart.toISOString();
  const to = viewEnd.toISOString();

  const { data: apiMembers = [] } = useTeamMembers(teamId);
  const { data: apiActivities = [], isLoading } = useTimelineActivities(teamId, timelineId, from, to);

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

  // Derive data needed by the unified filter engine from the passed-in statuses/tags/filters.
  const closedStatusIds = useMemo(
    () => new Set((timelineStatuses ?? []).filter(s => s.isClosed).map(s => s.id)),
    [timelineStatuses],
  );

  const statusesByTimeline = useMemo(() => {
    const m = new Map<string, Status[]>();
    if (timelineStatuses?.length) m.set(timelineId, timelineStatuses);
    return m;
  }, [timelineId, timelineStatuses]);

  // Map userId → team_member_id[] so the 'member' filter kind can resolve by userId.
  const memberIdsByUserId = useMemo(() => {
    const m = new Map<string, string[]>();
    apiMembers.forEach(member => {
      if (member.userId) {
        const existing = m.get(member.userId) ?? [];
        m.set(member.userId, [...existing, member.id]);
      }
    });
    return m;
  }, [apiMembers]);

  const visibleActivities = useMemo(() => applyActiveFilter(
    apiActivities,
    activeFilter,
    memberIdsByUserId,
    {
      closedStatusIds,
      savedFilters: savedFilters ?? [],
      statuses: statusesByTimeline,
      tags: tags ?? [],
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [apiActivities, activeFilter, memberIdsByUserId, closedStatusIds, savedFilters, statusesByTimeline, tags]);

  const statusColorById = useMemo(
    () => new Map((timelineStatuses ?? []).map(s => [s.id, s.color])),
    [timelineStatuses],
  );

  const rows: GanttRow[] = useMemo(() => {
    const richActivities = visibleActivities
      .map((ev, i) => toRichActivity(ev, i, memberById, viewStart, viewEnd, columns, colorBy, statusColorById))
      .filter((a): a is RichActivity => a !== null);
    return buildRows(richActivities, members, groupBy, sortBy, collapsedParents, collapsedGroups, timelineStatuses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleActivities, members, memberById, groupBy, sortBy, colorBy, statusColorById, viewStart, viewEnd, columns, collapsedParents, collapsedGroups, timelineStatuses]);

  // ── Find: compute matches and register with context ───────────────────────

  const matchResults = useMemo(
    () => matchEvents(debouncedQuery, visibleActivities, members, visibleActivities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, visibleActivities, members],
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
  }, [orderedMatchIds, computedMatchReasons, registerMatches]);

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
    const patch = {
      startAt: newStartDate.toISOString(),
      endAt: newEndDate.toISOString(),
    };

    // Synchronously update the cache so the bar doesn't flash back to old
    // position when GanttGrid clears its drag state in the same render cycle.
    queryClient.setQueriesData<ApiActivity[]>(
      { queryKey: ['timelines', timelineId, 'activities'] },
      (old) => old?.map((a) => (a.id === activityId ? { ...a, ...patch } : a)),
    );

    // Push updated activity to the sidebar so it shows new dates immediately
    // instead of the stale snapshot from when the activity was selected.
    if (onSelectApiActivity) {
      const updated = apiActivities.find(a => a.id === activityId);
      if (updated) onSelectApiActivity({ ...updated, ...patch });
    }

    onBarDragEnd?.();
    updateActivity.mutate({ activityId, patch });
  }, [updateActivity, onBarDragEnd, queryClient, timelineId, apiActivities, onSelectApiActivity]);

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
        onLaneDrag={interactive ? onLaneDrag : undefined}
        onBarDrag={interactive ? handleBarDrag : undefined}
        onBarDragProgress={interactive ? onBarDragProgress : undefined}
        resolvedGranularity={resolvedGranularity}
        onClearFilters={filtersActive ? () => {} : undefined}
        labelColW={labelColW}
        onLabelColWChange={onLabelColWChange}
        onToggleActivity={groupBy === 'parent' ? toggleParent : undefined}
        onToggleGroup={groupBy === 'member' || groupBy === 'status' ? toggleGroup : undefined}
        interactive={interactive}
      />
    </div>
  );
}
