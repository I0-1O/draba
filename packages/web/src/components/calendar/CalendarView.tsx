/**
 * CalendarView — data container for the Calendar grid.
 *
 * Mirrors GanttView's responsibilities: fetch activities + members, apply
 * the active filter and Find query, build the CalendarModel, and hand off
 * to CalendarGrid for rendering. Owns no layout chrome — colorBy, layout,
 * and anchorDate come from DashboardPage.
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CalendarLayout } from './CalendarToolbar';
import CalendarGrid from './CalendarGrid';
import { buildCalendarWeeks, type CalendarActivity } from '@/lib/calendarLanes';
import { resolveActivityColor } from '@/lib/activityColor';
import { useTimelineActivities, useTeamMembers, useUpdateActivity } from '@/hooks/useTeamActivities';
import { matchEvents } from '@/lib/findMatcher';
import { useFind } from '@/contexts/FindContext';
import { useFilter } from '@/contexts/FilterContext';
import { applyActiveFilter } from '@/lib/presetFilters';
import { usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences';
import type { components } from '@draba/shared';
import type { Member } from '@/types';
import { MEMBER_COLORS } from '@/types';
import { resolveColorHex } from '@/components/identity/identity-constants';

type ApiActivity = components['schemas']['Activity'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];
type Status = components['schemas']['Status'];
type SavedFilter = components['schemas']['SavedFilter'];
type Tag = components['schemas']['Tag'];

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_MONTH_CAP = 3;
const DEFAULT_WEEK_CAP  = 6;
const MONTH_WEEKS = 6;

// ── Helpers ───────────────────────────────────────────────────────────────────

function initialsFrom(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function toMember(m: TeamMemberWithUser, index: number): Member {
  const name = m.displayName || m.email || 'Unknown';
  return {
    id: m.id,
    name,
    initials: initialsFrom(name),
    color: resolveColorHex(m.color) || MEMBER_COLORS[index % MEMBER_COLORS.length],
  };
}

/**
 * Compute the UTC midnight Date of the first cell in the grid.
 *
 * Month: the weekStart on or before the 1st of the anchor month.
 * Week:  the anchor date itself (expected to be a weekStart).
 */
function computeGridStart(anchorDate: Date, layout: CalendarLayout, weekStartDay: 0 | 1): Date {
  if (layout === 'week') {
    const d = new Date(anchorDate);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  // Month: start from the weekStart on or before the 1st of the month.
  const firstOfMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  const dowOfFirst = firstOfMonth.getUTCDay(); // 0=Sun, 1=Mon, …
  // Days to go back to reach the previous weekStart.
  const daysBack = weekStartDay === 1
    ? (dowOfFirst === 0 ? 6 : dowOfFirst - 1)  // Monday start
    : dowOfFirst;                                // Sunday start
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - daysBack);
  return gridStart;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  timelineId: string;
  layout: CalendarLayout;
  /** UTC midnight of the anchor (month's 1st for Month, weekStart for Week). */
  anchorDate: Date;
  colorBy: 'activity' | 'member' | 'status';
  timelineStatuses?: Status[];
  savedFilters?: SavedFilter[];
  tags?: Tag[];
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  onSelectApiActivity?: (activity: ApiActivity | null) => void;
  /** Called during a bar drag with live snapped dates — for sidebar preview. */
  onBarDragProgress?: (activityId: string, newStart: Date, newEnd: Date) => void;
  /** Called when a bar drag ends (before the PATCH). */
  onBarDragEnd?: () => void;
  /** Called with the clicked empty-cell date — for create panel. */
  onCellClick?: (date: Date) => void;
  /** Called once members are loaded, so the parent can access them for panels. */
  onMembersLoaded?: (members: Member[]) => void;
}

// ── CalendarView ──────────────────────────────────────────────────────────────

export default function CalendarView({
  teamId,
  timelineId,
  layout,
  anchorDate,
  colorBy,
  timelineStatuses,
  savedFilters,
  tags,
  selectedActivityId,
  onSelectActivity,
  onSelectApiActivity,
  onBarDragProgress,
  onBarDragEnd,
  onCellClick,
  onMembersLoaded,
}: Props) {
  const queryClient = useQueryClient();
  const { debouncedQuery, registerMatches, activeMatchId } = useFind();
  const { activeFilter } = useFilter();
  const globalPrefs = usePreferenceMap();
  const upsert = useUpsertPreference();

  const weekStartDay: 0 | 1 = (globalPrefs['week_start'] as string | undefined) === 'sunday' ? 0 : 1;

  // Compute the grid start and week count.
  const gridStart = useMemo(
    () => computeGridStart(anchorDate, layout, weekStartDay),
    [anchorDate, layout, weekStartDay],
  );

  const weekCount = layout === 'month' ? MONTH_WEEKS : 1;

  // Fetch range: cover the full grid.
  const gridEnd = useMemo(() => {
    const d = new Date(gridStart);
    d.setUTCDate(d.getUTCDate() + weekCount * 7 - 1);
    return d;
  }, [gridStart, weekCount]);

  const from = gridStart.toISOString();
  const to   = gridEnd.toISOString();

  const { data: apiMembers = [] } = useTeamMembers(teamId);
  const { data: apiActivities = [], isLoading } = useTimelineActivities(teamId, timelineId, from, to);
  const updateActivity = useUpdateActivity(timelineId);

  const members: Member[] = useMemo(
    () => apiMembers.map((m, i) => toMember(m, i)),
    [apiMembers],
  );

  const memberById = useMemo<Record<string, Member>>(() => {
    const map: Record<string, Member> = {};
    members.forEach(m => { map[m.id] = m; });
    return map;
  }, [members]);

  useEffect(() => {
    if (onMembersLoaded && members.length > 0) onMembersLoaded(members);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  // Filter engine context.
  const closedStatusIds = useMemo(
    () => new Set((timelineStatuses ?? []).filter(s => s.isClosed).map(s => s.id)),
    [timelineStatuses],
  );
  const statusesByTimeline = useMemo(() => {
    const m = new Map<string, Status[]>();
    if (timelineStatuses?.length) m.set(timelineId, timelineStatuses);
    return m;
  }, [timelineId, timelineStatuses]);
  const memberIdsByUserId = useMemo(() => {
    const m = new Map<string, string[]>();
    apiMembers.forEach(mem => {
      if (mem.userId) {
        const existing = m.get(mem.userId) ?? [];
        m.set(mem.userId, [...existing, mem.id]);
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

  // Build CalendarActivity list with resolved colors.
  const calendarActivities: CalendarActivity[] = useMemo(() => {
    const statusById = new Map((timelineStatuses ?? []).map(s => [s.id, s]));
    const tagById    = new Map((tags ?? []).map(t => [t.id, t]));
    return visibleActivities.map((act, i) => {
      const status = act.statusId ? statusById.get(act.statusId) : undefined;
      const tagList = (act.tagIds ?? [])
        .map(id => tagById.get(id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
      return {
        id: act.id,
        startAt: act.startAt,
        endAt:   act.endAt,
        title:   act.title,
        color:   resolveActivityColor(act, i, memberById, colorBy, statusColorById),
        icon:    act.icon ?? undefined,
        assignedMemberIds: act.assignedMemberIds ?? [],
        statusName:  status?.name,
        statusColor: status ? (resolveColorHex(status.color ?? null) ?? undefined) : undefined,
        tags: tagList.map(t => ({ name: t.name, color: resolveColorHex(t.color ?? null) ?? undefined })),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleActivities, memberById, colorBy, statusColorById, timelineStatuses, tags]);

  // Activity lookup map for CalendarGrid (full ApiActivity for sidebar/create).
  const activityById = useMemo<Map<string, ApiActivity>>(
    () => new Map(apiActivities.map(a => [a.id, a])),
    [apiActivities],
  );

  // Per-week lane cap preferences.
  const laneCapsKey = `calendar_lane_caps_${layout}`;
  const storedCaps = useMemo<Record<string, number>>(() => {
    const raw = globalPrefs[laneCapsKey];
    if (typeof raw !== 'string') return {};
    try { return JSON.parse(raw) as Record<string, number>; } catch { return {}; }
  }, [globalPrefs, laneCapsKey]);

  // Also read per-timeline caps (stored in per-timeline prefs for this timeline).
  const timelinePrefs = usePreferenceMap(timelineId);
  const timelineCaps = useMemo<Record<string, number>>(() => {
    const raw = timelinePrefs[laneCapsKey];
    if (typeof raw !== 'string') return {};
    try { return JSON.parse(raw) as Record<string, number>; } catch { return {};  }
  }, [timelinePrefs, laneCapsKey]);

  // Merge: timeline caps take priority over global caps.
  const serverLaneCaps = useMemo<Record<string, number>>(
    () => ({ ...storedCaps, ...timelineCaps }),
    [storedCaps, timelineCaps],
  );

  // Ephemeral draft caps for immediate visual feedback during resize drag.
  // Overlaid on top of server caps so the grid re-renders instantly on every
  // pointermove without waiting for the preference mutation to round-trip.
  const [draftLaneCaps, setDraftLaneCaps] = useState<Record<string, number>>({});

  const laneCaps = useMemo<Record<string, number>>(
    () => ({ ...serverLaneCaps, ...draftLaneCaps }),
    [serverLaneCaps, draftLaneCaps],
  );

  // Visual-only update: called on every pointermove during resize drag.
  const handleCapDraft = useCallback((weekStart: Date, newCap: number) => {
    const key = weekStart.toISOString();
    setDraftLaneCaps(prev => ({ ...prev, [key]: newCap }));
  }, []);

  // Persist-on-release: called once on pointerup with the final cap.
  const handleCapCommit = useCallback((weekStart: Date, newCap: number) => {
    const key = weekStart.toISOString();
    // Apply to draft immediately (handles the case where onCapDraft wasn't
    // called on the last pointermove before pointerup).
    setDraftLaneCaps(prev => ({ ...prev, [key]: newCap }));
    if (!timelineId) return;
    const updated = { ...timelineCaps, [key]: newCap };
    upsert.mutate({ key: laneCapsKey, value: JSON.stringify(updated), timelineId });
  }, [timelineId, timelineCaps, upsert, laneCapsKey]);

  // Find: compute matches.
  const matchResults = useMemo(
    () => matchEvents(debouncedQuery, visibleActivities, members, visibleActivities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, visibleActivities, members],
  );

  const matchedSet = useMemo(() => new Set(matchResults.map(r => r.activityId)), [matchResults]);

  // Register ordered match IDs (visual order = sort by startAt within the grid).
  const orderedMatchIds = useMemo(() => {
    const sorted = [...visibleActivities].sort((a, b) =>
      a.startAt.localeCompare(b.startAt),
    );
    return sorted.filter(a => matchedSet.has(a.id)).map(a => a.id);
  }, [visibleActivities, matchedSet]);

  useEffect(() => {
    registerMatches(orderedMatchIds, new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedMatchIds]);

  const defaultLaneCap = layout === 'month' ? DEFAULT_MONTH_CAP : DEFAULT_WEEK_CAP;

  // Build the calendar model.
  const weeks = useMemo(
    () => buildCalendarWeeks(
      calendarActivities,
      gridStart,
      weekCount,
      laneCaps,
      defaultLaneCap,
      matchedSet,
      activeMatchId,
    ),
    [calendarActivities, gridStart, weekCount, laneCaps, defaultLaneCap, matchedSet, activeMatchId],
  );

  const hasQuery = debouncedQuery.trim().length > 0;

  // Today in UTC (for the today marker).
  const today = useMemo(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }, []);

  // ── Drag commit ────────────────────────────────────────────────────────────

  const handleBarDragCommit = useCallback((activityId: string, newStart: Date, newEnd: Date) => {
    const patch = {
      startAt: newStart.toISOString(),
      endAt:   newEnd.toISOString(),
    };

    // Optimistic cache update — mirrors GanttView.handleBarDrag.
    queryClient.setQueriesData<ApiActivity[]>(
      { queryKey: ['timelines', timelineId, 'activities'] },
      old => old?.map(a => a.id === activityId ? { ...a, ...patch } : a),
    );

    if (onSelectApiActivity) {
      const updated = apiActivities.find(a => a.id === activityId);
      if (updated) onSelectApiActivity({ ...updated, ...patch });
    }

    onBarDragEnd?.();
    updateActivity.mutate({ activityId, patch });
  }, [queryClient, timelineId, apiActivities, onSelectApiActivity, onBarDragEnd, updateActivity]);

  // ── Select ─────────────────────────────────────────────────────────────────

  const handleSelectActivity = useCallback((act: ApiActivity | null) => {
    if (onSelectApiActivity) onSelectApiActivity(act);
    if (onSelectActivity)    onSelectActivity(act?.id ?? null);
  }, [onSelectApiActivity, onSelectActivity]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 13 }}>
        Loading activities…
      </div>
    );
  }

  return (
    <CalendarGrid
      weeks={weeks}
      layout={layout}
      weekStartDay={weekStartDay}
      activityById={activityById}
      memberById={memberById}
      selectedActivityId={selectedActivityId ?? null}
      hasQuery={hasQuery}
      today={today}
      onSelectActivity={handleSelectActivity}
      onCellClick={date => onCellClick?.(date)}
      onBarDragProgress={(id, s, e) => onBarDragProgress?.(id, s, e)}
      onBarDragEnd={() => onBarDragEnd?.()}
      onBarDragCommit={handleBarDragCommit}
      onCapDraft={handleCapDraft}
      onCapCommit={handleCapCommit}
    />
  );
}
