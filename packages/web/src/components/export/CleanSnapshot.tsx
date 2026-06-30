/**
 * CleanSnapshot — off-screen, read-only renders used as the PNG export capture
 * target (Phase 14.3 rework).
 *
 * The live dashboard is full of editing chrome (drag handles, "+Add" buttons,
 * hover affordances) that has no business in a screenshot. Rather than hiding
 * that chrome post-hoc on the live DOM, these components reuse the exact same
 * `interactive=false` render path the Phase 13 share viewer already proved out
 * (GanttGrid / KanbanBoard with `interactive={false}`, and List's `PublicListTable`)
 * — but fed with the live, authenticated activity data instead of a public
 * share projection. No adapters are needed: DashboardPage's data is already in
 * the `ApiActivity`/`TeamMemberWithUser` shape these components expect.
 *
 * Each component is mounted inside DashboardPage's `PresentationFrame` — an
 * isolated, always-light iframe document — and intentionally left unconstrained
 * in width/height, so the capture covers the full natural extent with no
 * scroll-unclamping and no page-theme toggling.
 */

import { useMemo } from 'react'
import GanttGrid from '@/components/gantt/GanttGrid'
import { buildRows, toRichActivity, type RichActivity } from '@/components/gantt/GanttView'
import {
  buildListRows, COL_CATALOG, type ColMeta,
} from '@/components/list/ListView'
import type { ListGroupBy, ListSortBy } from '@/components/list/ListToolbar'
import KanbanBoard from '@/components/kanban/KanbanBoard'
import { buildColumns, buildHierarchyMaps } from '@/components/kanban/kanbanColumns'
import type { KanbanCardField, KanbanGroupBy, KanbanSortBy } from '@/components/kanban/KanbanToolbar'
import { resolveActivityColor } from '@/lib/activityColor'
import { PublicListTable } from '@/pages/ShareViewPage'
import {
  generateColumns, todayColumnPosition, autoFitGranularity,
} from '@/components/gantt/granularity'
import type { GroupBy, SortBy, ColorBy, TimeGranularity } from '@/components/gantt/GanttToolbar'
import type { Member } from '@/types'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

// ── Gantt ────────────────────────────────────────────────────────────────────

export interface CleanGanttSnapshotProps {
  activities: ApiActivity[]
  members: Member[]
  statuses: Status[]
  groupBy: GroupBy
  sortBy: SortBy
  colorBy: ColorBy
  granularity: TimeGranularity | 'auto'
  startDate?: string
  endDate?: string
  weekStart: 'monday' | 'sunday'
  locale: string
}

export function CleanGanttSnapshot({
  activities, members, statuses, groupBy, sortBy, colorBy, granularity, startDate, endDate, weekStart, locale,
}: CleanGanttSnapshotProps) {
  const viewStart = useMemo(() => startDate ? new Date(startDate) : new Date(Date.now() - 14 * 86_400_000), [startDate])
  const viewEnd = useMemo(() => endDate ? new Date(endDate) : new Date(Date.now() + 75 * 86_400_000), [endDate])

  const resolvedGranularity = useMemo<TimeGranularity>(
    () => granularity === 'auto' ? autoFitGranularity(viewStart, viewEnd, window.innerWidth || 1000) : granularity,
    [granularity, viewStart, viewEnd],
  )

  const columns = useMemo(
    () => generateColumns(viewStart, viewEnd, resolvedGranularity, { weekStart, locale }),
    [viewStart, viewEnd, resolvedGranularity, weekStart, locale],
  )

  const todayIdx = useMemo(() => todayColumnPosition(columns), [columns])

  const memberById = useMemo<Record<string, Member>>(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  )

  const statusColorById = useMemo(() => {
    const m = new Map<string, string>()
    statuses.forEach(s => m.set(s.id, s.color))
    return m
  }, [statuses])

  const richActivities = useMemo((): RichActivity[] => {
    if (columns.length === 0) return []
    return activities
      .map((a, i) => toRichActivity(a, i, memberById, viewStart, viewEnd, columns, colorBy, statusColorById))
      .filter((a): a is RichActivity => a !== null)
  }, [activities, memberById, viewStart, viewEnd, columns, colorBy, statusColorById])

  const rows = useMemo(
    () => buildRows(richActivities, members, groupBy, sortBy, new Set<string>(), new Set<string>(), statuses),
    [richActivities, members, groupBy, sortBy, statuses],
  )

  return (
    <GanttGrid
      rows={rows}
      columns={columns}
      todayIndex={todayIdx}
      selectedActivityId={null}
      onSelectActivity={() => {}}
      resolvedGranularity={resolvedGranularity}
      interactive={false}
    />
  )
}

// ── List ─────────────────────────────────────────────────────────────────────

export interface CleanListSnapshotProps {
  activities: ApiActivity[]
  members: TeamMemberWithUser[]
  statuses: Status[]
  tags: Tag[]
  groupBy: ListGroupBy
  sortBy: ListSortBy
  /** Visible column ids in order, or null for the default set — mirrors ListToolbar's ColumnConfig. */
  columns: { id: string; visible: boolean }[] | null
}

function compareForList(a: ApiActivity, b: ApiActivity, sortBy: ListSortBy): number {
  if (sortBy === 'startDate') return (a.startAt ?? '').localeCompare(b.startAt ?? '')
  if (sortBy === 'endDate') return (a.endAt ?? '').localeCompare(b.endAt ?? '')
  if (sortBy === 'title') return a.title.localeCompare(b.title)
  if (sortBy === 'status') return (a.statusId ?? '').localeCompare(b.statusId ?? '')
  if (sortBy === 'progress') return (b.percentComplete ?? 0) - (a.percentComplete ?? 0)
  return 0
}

export function CleanListSnapshot({ activities, members, statuses, tags, groupBy, sortBy, columns }: CleanListSnapshotProps) {
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const statusById = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses])
  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])
  const activityTitleById = useMemo(() => new Map(activities.map(a => [a.id, a.title])), [activities])

  const visibleColumns = useMemo<ColMeta[]>(() => {
    if (!columns) return COL_CATALOG.filter(c => c.defaultVisible)
    const byId = new Map(COL_CATALOG.map(c => [c.id, c]))
    return columns.filter(c => c.visible).map(c => byId.get(c.id)).filter((c): c is ColMeta => Boolean(c))
  }, [columns])

  const rows = useMemo(() => {
    const sorted = [...activities].sort((a, b) => compareForList(a, b, sortBy))
    return buildListRows(sorted, groupBy, memberById, statusById, statuses, new Set<string>())
  }, [activities, groupBy, sortBy, memberById, statusById, statuses])

  // Sized to the columns' own default widths so the off-screen shrink-to-fit
  // container doesn't collide with the table's internal width:100%/fixed colgroup.
  const width = useMemo(() => visibleColumns.reduce((sum, c) => sum + c.defaultWidth, 0), [visibleColumns])

  return (
    <div style={{ width, display: 'flex' }}>
      <PublicListTable
        rows={rows}
        visibleColumns={visibleColumns}
        memberById={memberById}
        statusById={statusById}
        tagById={tagById}
        activityTitleById={activityTitleById}
      />
    </div>
  )
}

// ── Kanban ───────────────────────────────────────────────────────────────────

export interface CleanKanbanSnapshotProps {
  activities: ApiActivity[]
  teamMembers: TeamMemberWithUser[]
  members: Member[]
  statuses: Status[]
  tags: Tag[]
  groupBy: KanbanGroupBy
  sortBy: KanbanSortBy
  colorBy: ColorBy
  cardFields: KanbanCardField[]
  showHierarchy: boolean
  collapsedColumnIds: string[]
}

export function CleanKanbanSnapshot({
  activities, teamMembers, members, statuses, tags, groupBy, sortBy, colorBy, cardFields, showHierarchy, collapsedColumnIds,
}: CleanKanbanSnapshotProps) {
  const statusById = useMemo(() => new Map(statuses.map(s => [s.id, s])), [statuses])
  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])
  const activityTitleById = useMemo(() => new Map(activities.map(a => [a.id, a.title])), [activities])
  const activityById = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities])

  const memberById = useMemo<Record<string, Member>>(
    () => Object.fromEntries(members.map(m => [m.id, m])),
    [members],
  )

  const statusColorById = useMemo(() => {
    const m = new Map<string, string>()
    statuses.forEach(s => m.set(s.id, s.color))
    return m
  }, [statuses])

  const colorMap = useMemo(() => {
    const m = new Map<string, string>()
    activities.forEach((a, i) => m.set(a.id, resolveActivityColor(a, i, memberById, colorBy, statusColorById)))
    return m
  }, [activities, memberById, colorBy, statusColorById])

  const hierarchy = useMemo(
    () => showHierarchy ? buildHierarchyMaps(activities) : { childrenByParentId: new Map<string, ApiActivity[]>(), childIds: new Set<string>() },
    [activities, showHierarchy],
  )

  const columnActivities = useMemo(
    () => showHierarchy ? activities.filter(a => !hierarchy.childIds.has(a.id)) : activities,
    [activities, showHierarchy, hierarchy],
  )

  const resolvedColumns = useMemo(
    () => buildColumns(groupBy, columnActivities, teamMembers, statuses, sortBy),
    [groupBy, columnActivities, teamMembers, statuses, sortBy],
  )

  const collapsedSet = useMemo(() => new Set(collapsedColumnIds), [collapsedColumnIds])

  return (
    <KanbanBoard
      columns={resolvedColumns}
      groupBy={groupBy}
      members={members}
      statusById={statusById}
      tagById={tagById}
      colorMap={colorMap}
      cardFields={cardFields}
      suppressedFields={new Set()}
      selectedActivityId={null}
      matchedIds={new Set()}
      activeMatchId={null}
      hasQuery={false}
      collapsedColumnIds={collapsedSet}
      onToggleCollapse={() => {}}
      onCardClick={() => {}}
      onAddInColumn={() => {}}
      onDrop={() => {}}
      activityById={activityById}
      activityTitleById={activityTitleById}
      showHierarchy={showHierarchy}
      childrenByParentId={hierarchy.childrenByParentId}
      collapsedParents={new Set()}
      onToggleParent={() => {}}
      interactive={false}
    />
  )
}
