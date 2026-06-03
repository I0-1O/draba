/**
 * KanbanView — data container for the Kanban board.
 *
 * Mirrors CalendarView: fetches activities + members, applies the active filter
 * and Find query, builds columns via kanbanColumns, and hands off to KanbanBoard
 * for rendering. Owns no layout chrome — groupBy, sortBy, colorBy, and cardFields
 * come from DashboardPage.
 */

import { useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import KanbanBoard from './KanbanBoard';
import {
  buildColumns,
  DEFAULT_CARD_FIELDS,
  type KanbanGroupBy,
  type KanbanSortBy,
  type KanbanCardField,
} from './kanbanColumns';
import { resolveActivityColor } from '@/lib/activityColor';
import { useTimelineActivities, useTeamMembers, useUpdateActivity } from '@/hooks/useTeamActivities';
import { matchEvents } from '@/lib/findMatcher';
import { useFind } from '@/contexts/FindContext';
import { useFilter } from '@/contexts/FilterContext';
import { applyActiveFilter } from '@/lib/presetFilters';
import { useUpsertPreference } from '@/hooks/usePreferences';
import { resolveColorHex } from '@/components/identity/identity-constants';
import type { ColorBy } from '@/components/gantt/GanttToolbar';
import type { components } from '@draba/shared';
import type { Member } from '@/types';
import { MEMBER_COLORS } from '@/types';
import type { DropPayload } from './KanbanBoard';

type ApiActivity = components['schemas']['Activity'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];
type Status = components['schemas']['Status'];
type SavedFilter = components['schemas']['SavedFilter'];
type Tag = components['schemas']['Tag'];

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

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  timelineId: string;
  groupBy: KanbanGroupBy;
  sortBy: KanbanSortBy;
  colorBy: ColorBy;
  cardFields: KanbanCardField[];
  collapsedColumnIds: string[];
  onCollapsedColumnIdsChange: (ids: string[]) => void;
  timelineStatuses?: Status[];
  savedFilters?: SavedFilter[];
  tags?: Tag[];
  selectedActivityId?: string | null;
  onSelectActivity?: (id: string | null) => void;
  onSelectApiActivity?: (activity: ApiActivity | null) => void;
  /** Called when "+ Add" is clicked in a column; provides pre-fill context. */
  onAddActivity?: (defaults: { start: string; end: string; memberId: string | null }) => void;
  onMembersLoaded?: (members: Member[]) => void;
}

// ── KanbanView ────────────────────────────────────────────────────────────────

export default function KanbanView({
  teamId,
  timelineId,
  groupBy,
  sortBy,
  colorBy,
  cardFields,
  collapsedColumnIds,
  onCollapsedColumnIdsChange,
  timelineStatuses,
  savedFilters,
  tags,
  selectedActivityId,
  onSelectActivity,
  onSelectApiActivity,
  onAddActivity,
  onMembersLoaded,
}: Props) {
  const queryClient = useQueryClient();
  const { debouncedQuery, registerMatches, activeMatchId } = useFind();
  const { activeFilter } = useFilter();
  const upsert = useUpsertPreference();

  // Fetch data — no date bounds for Kanban (show all activities on the timeline).
  const { data: apiMembers = [] } = useTeamMembers(teamId);
  const { data: apiActivities = [], isLoading } = useTimelineActivities(teamId, timelineId);
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

  const visibleActivities = useMemo(
    () => applyActiveFilter(
      apiActivities,
      activeFilter,
      memberIdsByUserId,
      {
        closedStatusIds,
        savedFilters: savedFilters ?? [],
        statuses: statusesByTimeline,
        tags: tags ?? [],
      },
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiActivities, activeFilter, memberIdsByUserId, closedStatusIds, savedFilters, statusesByTimeline, tags],
  );

  const statusById = useMemo(
    () => new Map((timelineStatuses ?? []).map(s => [s.id, s])),
    [timelineStatuses],
  );
  const statusColorById = useMemo(
    () => new Map((timelineStatuses ?? []).map(s => [s.id, s.color ?? ''])),
    [timelineStatuses],
  );
  const tagById = useMemo(
    () => new Map((tags ?? []).map(t => [t.id, t])),
    [tags],
  );

  // Per-activity resolved hex color (driven by colorBy) — used as card accent border.
  const colorMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    visibleActivities.forEach((act, i) => {
      map.set(act.id, resolveActivityColor(act, i, memberById, colorBy, statusColorById));
    });
    return map;
  }, [visibleActivities, memberById, colorBy, statusColorById]);

  // Build columns.
  const columns = useMemo(
    () => buildColumns(
      groupBy,
      visibleActivities,
      apiMembers,
      timelineStatuses ?? [],
      sortBy,
    ),
    [groupBy, visibleActivities, apiMembers, timelineStatuses, sortBy],
  );

  // Activity ID → ApiActivity map for drag overlay and optimistic updates.
  const activityById = useMemo<Map<string, ApiActivity>>(
    () => new Map(apiActivities.map(a => [a.id, a])),
    [apiActivities],
  );

  // Collapsed column persistence.
  const collapsedSet = useMemo(() => new Set(collapsedColumnIds), [collapsedColumnIds]);

  const handleToggleCollapse = useCallback((columnId: string) => {
    const next = collapsedSet.has(columnId)
      ? collapsedColumnIds.filter(id => id !== columnId)
      : [...collapsedColumnIds, columnId];
    onCollapsedColumnIdsChange(next);
    if (timelineId) {
      upsert.mutate({
        key: 'kanban_collapsed',
        value: JSON.stringify(next),
        timelineId,
      });
    }
  }, [collapsedSet, collapsedColumnIds, onCollapsedColumnIdsChange, timelineId, upsert]);

  // Find: compute matches.
  const matchResults = useMemo(
    () => matchEvents(debouncedQuery, visibleActivities, members, visibleActivities),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debouncedQuery, visibleActivities, members],
  );
  const matchedSet = useMemo(() => new Set(matchResults.map(r => r.activityId)), [matchResults]);

  // Register ordered match IDs in column → in-column sort order.
  const orderedMatchIds = useMemo(() => {
    const ids: string[] = [];
    for (const col of columns) {
      if (collapsedSet.has(col.id)) continue;
      for (const act of col.items) {
        if (matchedSet.has(act.id)) ids.push(act.id);
      }
    }
    return ids;
  }, [columns, collapsedSet, matchedSet]);

  useEffect(() => {
    registerMatches(orderedMatchIds, new Map());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedMatchIds]);

  // Auto-expand a collapsed column that contains the active match.
  useEffect(() => {
    if (!activeMatchId) return;
    const containingCol = columns.find(col =>
      collapsedSet.has(col.id) && col.items.some(a => a.id === activeMatchId),
    );
    if (containingCol) {
      handleToggleCollapse(containingCol.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMatchId]);

  // Derive which field is the current Group by axis (auto-suppressed on cards).
  const suppressedFields = useMemo((): Set<KanbanCardField> => {
    const s = new Set<KanbanCardField>();
    if (groupBy === 'status') s.add('status');
    if (groupBy === 'member' || groupBy === 'member-combination') s.add('members');
    if (groupBy === 'parent') s.add('parent');
    return s;
  }, [groupBy]);

  // Card click → open detail panel.
  const handleCardClick = useCallback((activity: ApiActivity) => {
    if (onSelectApiActivity) onSelectApiActivity(activity);
    if (onSelectActivity)    onSelectActivity(activity.id);
  }, [onSelectApiActivity, onSelectActivity]);

  // "+ Add" in a column → open create panel prefilled with the column's context.
  const handleAddInColumn = useCallback((column: { id: string; dropValue?: { assignedMemberIds?: string[] } }) => {
    const today = new Date().toISOString().slice(0, 10);
    const memberId = column.dropValue?.assignedMemberIds?.[0] ?? null;
    if (onAddActivity) {
      onAddActivity({ start: today, end: today, memberId });
    }
  }, [onAddActivity]);

  // Drag commit.
  const handleDrop = useCallback((payload: DropPayload) => {
    // Optimistic cache update.
    queryClient.setQueriesData<ApiActivity[]>(
      { queryKey: ['timelines', timelineId, 'activities'] },
      old => old?.map(a => a.id === payload.activityId ? { ...a, ...payload.patch } : a),
    );
    updateActivity.mutate({ activityId: payload.activityId, patch: payload.patch });
  }, [queryClient, timelineId, updateActivity]);

  const hasQuery = debouncedQuery.trim().length > 0;

  // ── Effective card fields: apply context-aware suppression at render time ────
  const effectiveCardFields = useMemo(
    () => (cardFields.length > 0 ? cardFields : DEFAULT_CARD_FIELDS),
    [cardFields],
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)', fontSize: 13 }}>
        Loading activities…
      </div>
    );
  }

  return (
    <KanbanBoard
      columns={columns}
      groupBy={groupBy}
      members={members}
      statusById={statusById}
      tagById={tagById}
      colorMap={colorMap}
      cardFields={effectiveCardFields}
      suppressedFields={suppressedFields}
      selectedActivityId={selectedActivityId ?? null}
      matchedIds={matchedSet}
      activeMatchId={activeMatchId}
      hasQuery={hasQuery}
      collapsedColumnIds={collapsedSet}
      onToggleCollapse={handleToggleCollapse}
      onCardClick={handleCardClick}
      onAddInColumn={handleAddInColumn}
      onDrop={handleDrop}
      activityById={activityById}
    />
  );
}
