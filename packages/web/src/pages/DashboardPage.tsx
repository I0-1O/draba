/**
 * Main application shell: sidebar + top bar + content area.
 *
 * Fetches the authenticated user's first team and first timeline to seed the
 * initial view. Team-selection UI and full sidebar wiring come in a later phase.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar, { type ViewMode } from '@/components/layout/TopBar'
import GanttView from '@/components/gantt/GanttView'
import { DEFAULT_LABEL_COL_W } from '@/components/gantt/GanttGrid'
import GanttToolbar, { type GroupBy, type SortBy, type TimeGranularity, type ColorBy } from '@/components/gantt/GanttToolbar'
import ListToolbar, { type ListGroupBy, type ListSortBy, type ListColorBy, type ListDensity, type ColumnConfig } from '@/components/list/ListToolbar'
import ListView, { buildListRows, type ListDisplayRow } from '@/components/list/ListView'
import CalendarToolbar, { formatAnchorLabel, type CalendarLayout } from '@/components/calendar/CalendarToolbar'
import CalendarView from '@/components/calendar/CalendarView'
import KanbanToolbar, { type KanbanGroupBy, type KanbanSortBy, type KanbanCardField } from '@/components/kanban/KanbanToolbar'
import KanbanView from '@/components/kanban/KanbanView'
import { DEFAULT_CARD_FIELDS, buildColumns, buildHierarchyMaps } from '@/components/kanban/kanbanColumns'
import type { TextExportData } from '@/components/ExportDialog'
import { CleanGanttSnapshot, CleanListSnapshot, CleanKanbanSnapshot } from '@/components/export/CleanSnapshot'
import PresentationFrame from '@/components/export/PresentationFrame'
import ActivityDetailPanel from '@/components/gantt/ActivityDetailPanel'
import ActivityCreatePanel from '@/components/gantt/ActivityCreatePanel'
import { FilterProvider, useFilter } from '@/contexts/FilterContext'
import { FindProvider, useFind } from '@/contexts/FindContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { usePreferences, usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { useMyTeams, useTeamTimelines, useTeamTimelinesWithArchived, useTeamActivitySync, useUnarchiveTeam, useUnarchiveTimeline, useTeamMembers, useTimelineActivities } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import { useSavedFilters } from '@/hooks/useSavedFilters'
import { useTags } from '@/hooks/useTags'
import TeamModal from '@/components/TeamModal'
import MemberModal from '@/components/MemberModal'
import TimelineModal from '@/components/TimelineModal'
import FilterManageModal from '@/components/filters/FilterManageModal'
import ShareModal from '@/components/ShareModal'
import CalendarShareModal from '@/components/CalendarShareModal'
import ExportDialog from '@/components/ExportDialog'
import { matchesFilter } from '@/lib/filterEngine'
import { applyActiveFilter } from '@/lib/presetFilters'
import { useNavigate } from 'react-router-dom'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']
type ApiTeam = components['schemas']['Team']
type ApiTimeline = components['schemas']['Timeline']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

/** Comparator for ListSortBy, shared by the export-scope ID ordering and the list-export display rows. */
function compareByListSort(a: ApiActivity, b: ApiActivity, listSortBy: ListSortBy): number {
  if (listSortBy === 'startDate') return (a.startAt ?? '').localeCompare(b.startAt ?? '')
  if (listSortBy === 'endDate') return (a.endAt ?? '').localeCompare(b.endAt ?? '')
  if (listSortBy === 'title') return a.title.localeCompare(b.title)
  if (listSortBy === 'status') return (a.statusId ?? '').localeCompare(b.statusId ?? '')
  if (listSortBy === 'progress') return (b.percentComplete ?? 0) - (a.percentComplete ?? 0)
  return 0
}

const DROPDOWN_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 14px',
  background: 'none',
  border: 'none',
  fontSize: 13,
  color: 'var(--foreground)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  textAlign: 'left',
}

function DashboardShell() {
  const { logout, accessToken, user } = useAuth()
  const { activeFilter, setActiveFilter } = useFilter()
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark, theme } = useDarkMode()
  const { setFindBarOpen } = useFind()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<ViewMode>('gantt')
  // Gantt label-column width — held here so it survives switching to another
  // view and back (GanttView unmounts on view change, which would reset it).
  const [ganttLabelColW, setGanttLabelColW] = useState(DEFAULT_LABEL_COL_W)
  // Close the detail sidebar when switching to list view (edits are inline there)
  const prevView = useRef<ViewMode>('gantt')
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedApiActivity, setSelectedApiActivity] = useState<ApiActivity | null>(null)
  const [ganttMembers, setGanttMembers] = useState<Member[]>([])
  const [createDefaults, setCreateDefaults] = useState<{ start: string; end: string; memberId: string | null; statusId?: string | null } | null>(null)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  // Content-area container — rasterized for the PNG export format (14.3) when
  // viewing Calendar, which has no clean/interactive=false renderer yet.
  const contentAreaRef = useRef<HTMLDivElement>(null)
  // Body of the PresentationFrame iframe that hosts the PNG export's clean
  // (interactive=false) snapshot — an isolated, always-light document reusing
  // the Phase 13 share viewer's render path for Gantt/List/Kanban. Captured as
  // the PNG target once the frame signals readiness. Calendar has no clean
  // renderer yet and still rasterizes the live content area.
  const [snapshotBody, setSnapshotBody] = useState<HTMLElement | null>(null)
  const handleSnapshotReady = useCallback((body: HTMLElement) => setSnapshotBody(body), [])
  // Calendar gets its own share surface — an ICS feed configurator, not the
  // active-links list (Phase 13.4).
  const [calendarShareModalOpen, setCalendarShareModalOpen] = useState(false)
  const [liveDragDates, setLiveDragDates] = useState<{ activityId: string; start: string; end: string } | null>(null)
  // Gantt toolbar state
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortBy, setSortBy] = useState<SortBy>('startDate')
  const [granularity, setGranularity] = useState<TimeGranularity | 'auto'>('auto')
  const [colorBy, setColorBy] = useState<ColorBy>('activity')
  // List toolbar state
  const [listGroupBy, setListGroupBy] = useState<ListGroupBy>('none')
  const [listSortBy, setListSortBy] = useState<ListSortBy>('startDate')
  const [listColorBy, setListColorBy] = useState<ListColorBy>('activity')
  const [listDensity, setListDensity] = useState<ListDensity>('comfortable')
  const [listColumns, setListColumns] = useState<ColumnConfig[]>([])
  // Incremented seq lets ListView know a new toggle has arrived
  const [listColToggle, setListColToggle] = useState<{ colId: string; visible: boolean; seq: number } | null>(null)
  const listColToggleSeq = useRef(0)
  // Calendar toolbar state
  const [calendarLayout, setCalendarLayout] = useState<CalendarLayout>('month')
  // anchorDate = UTC midnight of the 1st of the displayed month (month) or weekStart (week).
  const [calendarAnchorDate, setCalendarAnchorDate] = useState<Date>(() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(1)
    return d
  })
  // Kanban toolbar state
  const [kanbanGroupBy, setKanbanGroupBy] = useState<KanbanGroupBy>('status')
  const [kanbanSortBy, setKanbanSortBy] = useState<KanbanSortBy>('startDate')
  const [kanbanColorBy, setKanbanColorBy] = useState<ColorBy>('activity')
  const [kanbanCardFields, setKanbanCardFields] = useState<KanbanCardField[]>(DEFAULT_CARD_FIELDS)
  const [kanbanCollapsedColumns, setKanbanCollapsedColumns] = useState<string[]>([])
  const [kanbanShowHierarchy, setKanbanShowHierarchy] = useState(false)
  // Incremented to trigger inline row creation in list view
  const [listNewRowSeq, setListNewRowSeq] = useState(0)
  const profileRef = useRef<HTMLDivElement>(null)
  // Preference persistence
  const upsert = useUpsertPreference()
  // Track whether we've applied server prefs for the active timeline so we
  // don't immediately write defaults back before the server data arrives.
  const prefsAppliedForTimeline = useRef<string | null>(null)
  // One-shot guard: init activeTimelineId from global prefs only on first load.
  const timelineIdInitialized = useRef(false)


  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close the detail sidebar when switching to list view (list edits are inline).
  useEffect(() => {
    if (view === 'list' && prevView.current !== 'list') {
      setSelectedActivityId(null)
      setSelectedApiActivity(null)
      setCreateDefaults(null)
    }
    prevView.current = view
  }, [view])

  // Ctrl/Cmd+F opens the Find bar; browser default (page search) is suppressed.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setFindBarOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setFindBarOpen])

  const displayName = (user as { displayName?: string } | null)?.displayName ?? 'User'
  const email = (user as { email?: string } | null)?.email ?? ''
  const userIdentity: Identity = {
    color: (user as { color?: string } | null)?.color ?? '#288C9B',
    icon: (user as { icon?: string } | null)?.icon ?? '__name_2__',
  }

  // Global preferences — restored on login to seed team/timeline selection.
  const { isSuccess: globalPrefsSettled } = usePreferences()
  const globalPrefMap = usePreferenceMap()
  const weekStartDay: 0 | 1 = (globalPrefMap['week_start'] as string | undefined) === 'sunday' ? 0 : 1
  // Mirrors GanttView's own pref-derived column locale — used by the PNG
  // export's off-screen CleanGanttSnapshot, which builds its own columns.
  const prefWeekStart: 'monday' | 'sunday' = (globalPrefMap['week_start'] as string | undefined) === 'sunday' ? 'sunday' : 'monday'
  const prefDateFormat = (globalPrefMap['date_format'] as string | undefined) ?? 'MMM D, YYYY'
  const prefLocale = prefDateFormat === 'DD/MM/YYYY' ? 'en-GB' : 'en-US'

  // Team modal state
  const [teamModalMode, setTeamModalMode] = useState<'new' | 'edit' | null>(null)
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null)
  const unarchiveTeam = useUnarchiveTeam()

  // Member modal state
  const [editingMember, setEditingMember] = useState<TeamMemberWithUser | null>(null)

  // Timeline modal state
  const [timelineModalMode, setTimelineModalMode] = useState<'new' | 'edit' | null>(null)
  const [editingTimeline, setEditingTimeline] = useState<ApiTimeline | null>(null)

  // Fetch all teams including archived for the sidebar's archived section.
  const { data: allTeams = [] } = useMyTeams(true)
  const activeTeams = allTeams.filter(t => !t.archivedAt)
  const archivedTeams = allTeams.filter(t => Boolean(t.archivedAt))

  // Explicit team selection state — null until the global pref is applied so
  // that timelines (and the timeline init effect) don't fire against the wrong
  // fallback team before the saved team pref resolves.
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null)
  const teamIdInitialized = useRef(false)
  useEffect(() => {
    if (!activeTeams.length || !globalPrefsSettled || teamIdInitialized.current) return
    teamIdInitialized.current = true
    const saved = typeof globalPrefMap['selected_team'] === 'string' ? globalPrefMap['selected_team'] : null
    const exists = saved && activeTeams.some(t => t.id === saved)
    setActiveTeamId(exists ? saved : activeTeams[0].id)
  }, [activeTeams, globalPrefsSettled, globalPrefMap])

  // Only derive an active team once the pref has been applied (activeTeamId !== null).
  // The activeTeams[0] fallback here handles the edge case where the saved team
  // was archived or deleted between sessions.
  const activeTeam = activeTeamId !== null
    ? (activeTeams.find(t => t.id === activeTeamId) ?? activeTeams[0] ?? undefined)
    : undefined
  const teamId = activeTeam?.id ?? ''

  // Check whether the current user is an admin of the active team.
  const { data: teamMembers = [] } = useTeamMembers(teamId)
  const userId = (user as { id?: string } | null)?.id ?? ''
  const isSuperadmin = Boolean((user as { isSuperadmin?: boolean } | null)?.isSuperadmin)
  const canEditTeam = isSuperadmin || teamMembers.some(m => m.userId === userId && m.role === 'admin')

  const handleSelectTeam = useCallback((id: string) => {
    setActiveTeamId(id)
    // Clear the stale timeline selection so the init effect re-fires with the
    // new team's timeline list. Without this, the old timeline ID leaks into
    // the new team's API requests and produces 404s.
    setActiveTimelineId(undefined)
    prefsAppliedForTimeline.current = null
    timelineIdInitialized.current = false
    // Clear the selected activity too, otherwise the old team's activity
    // stays pinned in the right sidebar after switching teams.
    setSelectedActivityId(null)
    setSelectedApiActivity(null)
    setCreateDefaults(null)
  }, [])

  const unarchiveTimeline = useUnarchiveTimeline(teamId)

  const { data: timelines = [] } = useTeamTimelines(teamId)
  const { data: allTimelines = [] } = useTeamTimelinesWithArchived(teamId)
  const archivedTimelines = allTimelines.filter(t => Boolean(t.archivedAt))
  const [activeTimelineId, setActiveTimelineId] = useState<string | undefined>()
  const { data: activeTimelineStatuses = [] } = useTimelineStatuses(teamId, activeTimelineId ?? '')
  const { data: savedFilters = [] } = useSavedFilters(teamId)
  const { data: tags = [] } = useTags(teamId)
  // Initialize activeTimelineId from the saved global pref (selected_timeline),
  // falling back to timelines[0] when no pref is stored or the saved timeline
  // is no longer in the list. Waits for global prefs to settle so we don't
  // immediately overwrite a restored value with the fallback.
  useEffect(() => {
    if (timelines.length === 0 || !globalPrefsSettled || timelineIdInitialized.current) return
    timelineIdInitialized.current = true
    const saved = typeof globalPrefMap['selected_timeline'] === 'string' ? globalPrefMap['selected_timeline'] : null
    const exists = saved && timelines.some(t => t.id === saved)
    setActiveTimelineId(exists ? saved : timelines[0].id)
  }, [timelines, globalPrefsSettled, globalPrefMap])
  const activeTimeline = timelines.find(t => t.id === activeTimelineId) ?? timelines[0]
  // Derived so they stay in sync after edits without needing separate state.
  const activeTimelineColor = activeTimeline?.color ?? '#1A97A2'
  const activeTimelineName = activeTimeline?.name ?? ''
  const activeTimelineIdentity: Identity = {
    color: activeTimeline?.color ?? '#288C9B',
    icon: activeTimeline?.icon ?? '__none__',
  }

  // The frozen filter snapshot captured into a share's view config — shared
  // across Gantt/List/Kanban since `activeFilter` applies to the whole timeline.
  const activeShareFilter = useMemo(() => {
    if (activeFilter.kind !== 'saved') return null
    const sf = savedFilters.find(f => f.id === activeFilter.id)
    if (!sf) return null
    try { return JSON.parse(sf.definition) as import('@/lib/filterTypes').FilterDefinition } catch { return null }
  }, [activeFilter, savedFilters])

  // Unbounded activity list for the active timeline — used by the export
  // dialog's filter-context strip and "scope" counts. Cached separately from
  // each view's (possibly date-bounded) activity query.
  const { data: allActivities = [] } = useTimelineActivities(teamId, activeTimelineId ?? '')

  // Export dialog: filter context, counts, and the filtered activity list.
  // filteredActivities is exposed so exportViewActivityIds can sort it for list view.
  const exportFilterInfo = useMemo(() => {
    const totalCount = allActivities.length
    const closedStatusIds = new Set(activeTimelineStatuses.filter(s => s.isClosed).map(s => s.id))
    const memberIdsByUserId = new Map<string, string[]>()
    for (const m of teamMembers) {
      if (!m.userId) continue
      const list = memberIdsByUserId.get(m.userId) ?? []
      list.push(m.id)
      memberIdsByUserId.set(m.userId, list)
    }
    const filterCtx = {
      closedStatusIds,
      savedFilters,
      statuses: new Map(activeTimelineId ? [[activeTimelineId, activeTimelineStatuses]] as const : []),
      tags,
    }

    if (activeFilter.kind === 'preset' && activeFilter.id !== 'all') {
      const PRESET_LABELS: Record<string, string> = {
        open: 'Open only', upcoming: 'Upcoming', overdue: 'Overdue', noassign: 'No one assigned',
      }
      const filterLabel = PRESET_LABELS[activeFilter.id] ?? activeFilter.id
      const filteredActivities = applyActiveFilter(allActivities, activeFilter, memberIdsByUserId, filterCtx)
      return { filterLabel, filterDefinition: null, filteredCount: filteredActivities.length, totalCount, filteredActivities }
    }

    if (activeFilter.kind === 'member') {
      const member = teamMembers.find(m => m.userId === (activeFilter as { kind: 'member'; userId: string }).userId)
      const filterLabel = member?.displayName ?? 'Team member'
      const filteredActivities = applyActiveFilter(allActivities, activeFilter, memberIdsByUserId, filterCtx)
      return { filterLabel, filterDefinition: null, filteredCount: filteredActivities.length, totalCount, filteredActivities }
    }

    if (activeFilter.kind === 'saved' && activeShareFilter) {
      const saved = savedFilters.find(f => f.id === activeFilter.id)
      const statusesByTimeline = new Map(activeTimelineId ? [[activeTimelineId, activeTimelineStatuses]] as const : [])
      const filteredActivities = allActivities.filter(a => matchesFilter(a, activeShareFilter, { statusesByTimeline, tags }))
      return { filterLabel: saved?.name ?? 'Saved filter', filterDefinition: activeShareFilter, filteredCount: filteredActivities.length, totalCount, filteredActivities }
    }

    return { filterLabel: null, filterDefinition: null, filteredCount: totalCount, totalCount, filteredActivities: allActivities }
  }, [allActivities, activeFilter, activeShareFilter, savedFilters, activeTimelineId, activeTimelineStatuses, tags, teamMembers])

  // Ordered activity IDs for the export "current view" scope.
  // Sent as activityIds in the request when: a preset/member filter is active
  // (can't be evaluated server-side), or we're in list view (to preserve sort order).
  const exportViewActivityIds = useMemo<string[] | null>(() => {
    const hasNonSavedFilter = activeFilter.kind === 'preset' ? activeFilter.id !== 'all' : activeFilter.kind === 'member'
    const needsIds = hasNonSavedFilter || view === 'list'
    if (!needsIds) return null

    let acts = exportFilterInfo.filteredActivities
    if (view === 'list') {
      acts = [...acts].sort((a, b) => compareByListSort(a, b, listSortBy))
    }
    return acts.map(a => a.id)
  }, [exportFilterInfo.filteredActivities, activeFilter, view, listSortBy])

  // List-view column visibility mapped to export column names.
  // Null when not in list view or when all columns are visible (server defaults to all).
  const exportListColumns = useMemo<string[] | null>(() => {
    if (view !== 'list' || listColumns.length === 0) return null
    const COL_MAP: Record<string, string> = {
      title: 'Title', startAt: 'Start', endAt: 'End', description: 'Description',
      status: 'Status', assignees: 'Assignees', tags: 'Tags', parent: 'Parent',
      progress: 'Progress', location: 'Location', url: 'URL',
    }
    const cols = listColumns.filter(c => c.visible && COL_MAP[c.id]).map(c => COL_MAP[c.id])
    // If all mappable columns are visible, skip sending — server defaults to all
    const allExportCols = Object.values(COL_MAP)
    if (cols.length === allExportCols.length) return null
    return cols
  }, [view, listColumns])

  // Pre-resolved data for client-side textual exports (14.2).
  // Only materialised for non-Gantt views (Gantt has no textual format).
  const textExportData = useMemo<TextExportData | null>(() => {
    if (view === 'gantt') return null

    const memberById = new Map<string, string>(
      teamMembers.map(m => [m.id, m.displayName || m.email || 'Unknown']),
    )
    const statusById = new Map<string, string>(
      activeTimelineStatuses.map(s => [s.id, s.name]),
    )
    const tagById = new Map<string, string>(tags.map(t => [t.id, t.name]))
    const activityTitleById = new Map<string, string>(allActivities.map(a => [a.id, a.title]))
    const activities = exportFilterInfo.filteredActivities

    // List view: pre-build sorted, grouped, hierarchy-aware display rows.
    let listDisplayRows: ListDisplayRow[] | null = null
    let listVisibleColumns: string[] | null = null
    if (view === 'list') {
      const sorted = [...activities].sort((a, b) => compareByListSort(a, b, listSortBy))
      const memberByIdObj = new Map(
        teamMembers.map(m => [m.id, { displayName: m.displayName || m.email || 'Unknown', color: m.color }]),
      )
      const statusByIdObj = new Map(activeTimelineStatuses.map(s => [s.id, { name: s.name }]))
      listDisplayRows = buildListRows(
        sorted, listGroupBy, memberByIdObj, statusByIdObj,
        activeTimelineStatuses, new Set(), teamMembers.map(m => m.id),
      )
      listVisibleColumns = listColumns.length > 0
        ? listColumns.filter(c => c.visible && !['colorBar', 'identity'].includes(c.id)).map(c => c.id)
        : null
    }

    // Kanban: build columns respecting the hierarchy toggle.
    let kanbanColumns: Array<{ label: string; activities: ApiActivity[] }> | null = null
    let kbHierarchy = false
    let kbChildrenById = new Map<string, ApiActivity[]>()
    if (view === 'kanban') {
      kbHierarchy = kanbanShowHierarchy
      const { childrenByParentId, childIds } = kbHierarchy
        ? buildHierarchyMaps(activities)
        : { childrenByParentId: new Map<string, ApiActivity[]>(), childIds: new Set<string>() }
      kbChildrenById = childrenByParentId
      const columnActivities = kbHierarchy ? activities.filter(a => !childIds.has(a.id)) : activities
      kanbanColumns = buildColumns(kanbanGroupBy, columnActivities, teamMembers, activeTimelineStatuses, kanbanSortBy)
        .map(col => ({ label: col.label, activities: col.items }))
    }

    return {
      activities,
      memberById,
      statusById,
      tagById,
      activityTitleById,
      kanbanColumns,
      listDisplayRows,
      listVisibleColumns,
      kanbanShowHierarchy: kbHierarchy,
      kanbanChildrenByParentId: kbChildrenById,
    }
  }, [
    view, teamMembers, activeTimelineStatuses, tags, allActivities,
    exportFilterInfo.filteredActivities, kanbanGroupBy, kanbanSortBy, kanbanShowHierarchy,
    listGroupBy, listSortBy, listColumns,
  ])

  // Close the activity detail panel whenever the active filter changes so the
  // filtered view is unobstructed by a stale selection.
  useEffect(() => {
    setSelectedActivityId(null)
    setSelectedApiActivity(null)
  }, [activeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTimelineChange = useCallback((id: string) => {
    prefsAppliedForTimeline.current = null
    setActiveTimelineId(id)
    setActiveFilter({ kind: 'preset', id: 'all' })
  }, [setActiveFilter])

  // Calendar navigation helpers.
  const calendarPrev = useCallback(() => {
    setCalendarAnchorDate(prev => {
      const d = new Date(prev)
      if (calendarLayout === 'month') {
        d.setUTCMonth(d.getUTCMonth() - 1)
      } else {
        d.setUTCDate(d.getUTCDate() - 7)
      }
      return d
    })
  }, [calendarLayout])

  const calendarNext = useCallback(() => {
    setCalendarAnchorDate(prev => {
      const d = new Date(prev)
      if (calendarLayout === 'month') {
        d.setUTCMonth(d.getUTCMonth() + 1)
      } else {
        d.setUTCDate(d.getUTCDate() + 7)
      }
      return d
    })
  }, [calendarLayout])

  const calendarToday = useCallback(() => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    if (calendarLayout === 'month') {
      d.setUTCDate(1)
    } else {
      // Snap to weekStart.
      const dow = d.getUTCDay()
      const daysBack = weekStartDay === 1 ? (dow === 0 ? 6 : dow - 1) : dow
      d.setUTCDate(d.getUTCDate() - daysBack)
    }
    setCalendarAnchorDate(d)
  }, [calendarLayout, weekStartDay])

  // Switching layouts also snaps the anchor date to the correct boundary so
  // the week-view always starts on the configured weekStart day.
  const handleCalendarLayoutChange = useCallback((l: CalendarLayout) => {
    setCalendarLayout(l)
    setCalendarAnchorDate(prev => {
      const d = new Date(prev)
      d.setUTCHours(0, 0, 0, 0)
      if (l === 'week') {
        const dow = d.getUTCDay()
        const daysBack = weekStartDay === 1 ? (dow === 0 ? 6 : dow - 1) : dow
        d.setUTCDate(d.getUTCDate() - daysBack)
      } else {
        d.setUTCDate(1)
      }
      return d
    })
  }, [weekStartDay])

  useTeamActivitySync(teamId, accessToken)

  // Per-timeline preferences: restore toolbar state when the active timeline changes.
  // isSuccess gate ensures we don't mark prefs applied before the query resolves.
  const { isSuccess: prefsSettled } = usePreferences(activeTimelineId)
  const timelinePrefs = usePreferenceMap(activeTimelineId)
  useEffect(() => {
    if (!activeTimelineId || !prefsSettled) return
    if (prefsAppliedForTimeline.current === activeTimelineId) return
    prefsAppliedForTimeline.current = activeTimelineId

    if (typeof timelinePrefs['group_by'] === 'string') setGroupBy(timelinePrefs['group_by'] as GroupBy)
    if (typeof timelinePrefs['sort_by'] === 'string') setSortBy(timelinePrefs['sort_by'] as SortBy)
    if (typeof timelinePrefs['zoom_granularity'] === 'string') setGranularity(timelinePrefs['zoom_granularity'] as TimeGranularity | 'auto')
    if (typeof timelinePrefs['color_by'] === 'string') setColorBy(timelinePrefs['color_by'] as ColorBy)
    if (typeof timelinePrefs['list_group_by'] === 'string') setListGroupBy(timelinePrefs['list_group_by'] as ListGroupBy)
    if (typeof timelinePrefs['list_sort_by'] === 'string') setListSortBy(timelinePrefs['list_sort_by'] as ListSortBy)
    if (typeof timelinePrefs['list_color_by'] === 'string') setListColorBy(timelinePrefs['list_color_by'] as ListColorBy)
    if (typeof timelinePrefs['list_density'] === 'string') setListDensity(timelinePrefs['list_density'] as ListDensity)
    if (typeof timelinePrefs['view_mode'] === 'string') setView(timelinePrefs['view_mode'] as ViewMode)
    if (typeof timelinePrefs['kanban_group_by'] === 'string') setKanbanGroupBy(timelinePrefs['kanban_group_by'] as KanbanGroupBy)
    if (typeof timelinePrefs['kanban_sort_by'] === 'string') setKanbanSortBy(timelinePrefs['kanban_sort_by'] as KanbanSortBy)
    if (typeof timelinePrefs['kanban_color_by'] === 'string') setKanbanColorBy(timelinePrefs['kanban_color_by'] as ColorBy)
    if (typeof timelinePrefs['kanban_card_fields'] === 'string') {
      try { setKanbanCardFields(JSON.parse(timelinePrefs['kanban_card_fields']) as KanbanCardField[]) } catch { /* ignore */ }
    }
    if (typeof timelinePrefs['kanban_collapsed'] === 'string') {
      try { setKanbanCollapsedColumns(JSON.parse(timelinePrefs['kanban_collapsed']) as string[]) } catch { /* ignore */ }
    }
    if (typeof timelinePrefs['kanban_show_hierarchy'] === 'string') {
      try { setKanbanShowHierarchy(JSON.parse(timelinePrefs['kanban_show_hierarchy']) as boolean) } catch { /* ignore */ }
    }
  }, [activeTimelineId, prefsSettled, timelinePrefs])

  // Save toolbar state changes to per-timeline prefs.
  const saveTimelinePref = useCallback((key: string, value: string) => {
    if (!activeTimelineId) return
    upsert.mutate({ key, value: JSON.stringify(value), timelineId: activeTimelineId })
  }, [activeTimelineId, upsert.mutate]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('group_by', groupBy)
  }, [groupBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('sort_by', sortBy)
  }, [sortBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('zoom_granularity', granularity)
  }, [granularity, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('color_by', colorBy)
  }, [colorBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('view_mode', view)
  }, [view, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('list_group_by', listGroupBy)
  }, [listGroupBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('list_sort_by', listSortBy)
  }, [listSortBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('list_color_by', listColorBy)
  }, [listColorBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('list_density', listDensity)
  }, [listDensity, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('kanban_group_by', kanbanGroupBy)
  }, [kanbanGroupBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('kanban_sort_by', kanbanSortBy)
  }, [kanbanSortBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('kanban_color_by', kanbanColorBy)
  }, [kanbanColorBy, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('kanban_card_fields', JSON.stringify(kanbanCardFields))
  }, [kanbanCardFields, saveTimelinePref])

  useEffect(() => {
    if (prefsAppliedForTimeline.current !== activeTimelineId) return
    saveTimelinePref('kanban_show_hierarchy', JSON.stringify(kanbanShowHierarchy))
  }, [kanbanShowHierarchy, saveTimelinePref])

  // Global preferences: persist dark mode, active team, and active timeline.
  useEffect(() => {
    upsert.mutate({ key: 'theme', value: JSON.stringify(theme) })
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!teamId) return
    upsert.mutate({ key: 'selected_team', value: JSON.stringify(teamId) })
  }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeTimelineId) return
    upsert.mutate({ key: 'selected_timeline', value: JSON.stringify(activeTimelineId) })
  }, [activeTimelineId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset label column width when the user switches timelines so each timeline
  // starts fresh. Switching between views on the same timeline preserves width
  // because the state lives here rather than inside the unmounting GanttView.
  useEffect(() => {
    setGanttLabelColW(DEFAULT_LABEL_COL_W)
  }, [activeTimelineId])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        apiTimelines={timelines}
        archivedTimelines={archivedTimelines}
        activeTimelineId={activeTimelineId}
        onActiveTimelineChange={handleTimelineChange}
        onNewTimeline={() => { setEditingTimeline(null); setTimelineModalMode('new') }}
        onEditTimeline={id => {
          // timelines (active) is always loaded; allTimelines (?archived=true) may
          // still be in-flight, so prefer the already-loaded list to avoid opening
          // the modal with an undefined timeline and blank fields.
          const tl = timelines.find(t => t.id === id) ?? allTimelines.find(t => t.id === id)
          setEditingTimeline(tl ?? null)
          setTimelineModalMode('edit')
        }}
        onNewActivity={() => {
          const today = new Date().toISOString().slice(0, 10)
          setSelectedActivityId(null)
          setSelectedApiActivity(null)
          if (view === 'list') {
            setListNewRowSeq(s => s + 1)
          } else {
            setCreateDefaults({ start: today, end: today, memberId: null })
          }
        }}
        activeTeam={activeTeam}
        activeTeams={activeTeams}
        archivedTeams={archivedTeams}
        canEditTeam={canEditTeam}
        onSelectTeam={handleSelectTeam}
        onNewTeam={isSuperadmin ? () => { setEditingTeam(null); setTeamModalMode('new'); } : undefined}
        onEditTeam={t => { setEditingTeam(t as ApiTeam); setTeamModalMode('edit'); }}
        onUnarchiveTeam={id => unarchiveTeam.mutate(id)}
        members={teamMembers.length > 0 ? teamMembers : undefined}
        onEditMember={isSuperadmin ? m => setEditingMember(m) : undefined}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          view={view}
          teamId={teamId}
          timelineName={activeTimelineName}
          timelineIdentity={activeTimelineIdentity}
          onViewChange={setView}
          onOpenFilterManager={() => setFilterModalOpen(true)}
          rightSlot={
            <div ref={profileRef} style={{ position: 'relative', marginLeft: 4, zIndex: 30 }}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                title={displayName}
              >
                <Badge identity={userIdentity} name={displayName} shape="circle" size={28} />
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: 220,
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{email}</div>
                  </div>
                  <button
                    onClick={toggleDark}
                    style={{ ...DROPDOWN_BTN, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {isDark ? <Moon size={14} strokeWidth={1.8} /> : <Sun size={14} strokeWidth={1.8} />}
                    {isDark ? 'Dark mode' : 'Light mode'}
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                    style={{ ...DROPDOWN_BTN, borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Settings size={14} strokeWidth={1.8} />
                    Settings
                  </button>
                  <button
                    onClick={logout}
                    style={{ ...DROPDOWN_BTN, color: 'var(--muted-foreground)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={14} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          }
        />

        {/* Active timeline color band */}
        <div style={{ height: 3, background: activeTimelineColor, flexShrink: 0, transition: 'background 0.2s ease' }} />

        {/* Gantt sub-toolbar — only shown in Gantt view */}
        {view === 'gantt' && (
          <GanttToolbar
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            granularity={granularity}
            onGranularityChange={setGranularity}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            onExport={() => setExportDialogOpen(true)}
            onShare={() => setShareModalOpen(true)}
          />
        )}

        {/* List sub-toolbar — only shown in List view */}
        {view === 'list' && (
          <ListToolbar
            columns={listColumns}
            onColumnVisibilityChange={(colId, visible) => {
              listColToggleSeq.current += 1
              setListColToggle({ colId, visible, seq: listColToggleSeq.current })
              setListColumns(prev => prev.map(c => c.id === colId ? { ...c, visible } : c))
            }}
            density={listDensity}
            onDensityChange={setListDensity}
            groupBy={listGroupBy}
            onGroupByChange={setListGroupBy}
            sortBy={listSortBy}
            onSortByChange={setListSortBy}
            colorBy={listColorBy}
            onColorByChange={setListColorBy}
            onExport={() => setExportDialogOpen(true)}
            onShare={() => setShareModalOpen(true)}
          />
        )}

        {/* Calendar sub-toolbar — only shown in Calendar view */}
        {view === 'calendar' && (
          <CalendarToolbar
            layout={calendarLayout}
            onLayoutChange={handleCalendarLayoutChange}
            anchorDate={calendarAnchorDate}
            onPrev={calendarPrev}
            onNext={calendarNext}
            onToday={calendarToday}
            colorBy={colorBy}
            onColorByChange={setColorBy}
            onExport={() => setExportDialogOpen(true)}
            onShare={() => setCalendarShareModalOpen(true)}
          />
        )}

        {/* Kanban sub-toolbar — only shown in Kanban view */}
        {view === 'kanban' && (
          <KanbanToolbar
            groupBy={kanbanGroupBy}
            onGroupByChange={setKanbanGroupBy}
            sortBy={kanbanSortBy}
            onSortByChange={setKanbanSortBy}
            colorBy={kanbanColorBy}
            onColorByChange={setKanbanColorBy}
            cardFields={kanbanCardFields}
            onCardFieldsChange={setKanbanCardFields}
            showHierarchy={kanbanShowHierarchy}
            onShowHierarchyChange={setKanbanShowHierarchy}
            onExport={() => setExportDialogOpen(true)}
            onShare={() => setShareModalOpen(true)}
          />
        )}

        {/* Content area */}
        <div ref={contentAreaRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'gantt' && teamId && activeTimelineId ? (
            <GanttView
              teamId={teamId}
              timelineId={activeTimelineId}
              startDate={activeTimeline?.startDate}
              endDate={activeTimeline?.endDate}
              groupBy={groupBy}
              sortBy={sortBy}
              granularity={granularity}
              colorBy={colorBy}
              timelineStatuses={activeTimelineStatuses}
              savedFilters={savedFilters}
              tags={tags}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => {
                setSelectedActivityId(id)
                if (!id) { setSelectedApiActivity(null); setCreateDefaults(null) }
              }}
              onSelectApiActivity={(activity) => {
                setSelectedApiActivity(activity)
                setCreateDefaults(null)
              }}
              onBarDragProgress={(activityId, newStart, newEnd) => {
                setLiveDragDates({
                  activityId,
                  start: newStart.toISOString().slice(0, 10),
                  end: newEnd.toISOString().slice(0, 10),
                })
              }}
              onBarDragEnd={() => setLiveDragDates(null)}
              onMembersLoaded={setGanttMembers}
              labelColW={ganttLabelColW}
              onLabelColWChange={setGanttLabelColW}
            />
          ) : view === 'gantt' && (!teamId || !activeTimelineId) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading your team…</p>
            </div>
          ) : view === 'list' && teamId && activeTimelineId ? (
            <ListView
              teamId={teamId}
              timelineId={activeTimelineId}
              groupBy={listGroupBy}
              sortBy={listSortBy}
              colorBy={listColorBy}
              density={listDensity}
              timelineStatuses={activeTimelineStatuses}
              savedFilters={savedFilters}
              tags={tags}
              selectedActivityId={selectedActivityId}
              pendingColumnToggle={listColToggle}
              onSelectActivity={(id) => {
                setSelectedActivityId(id)
                if (!id) { setSelectedApiActivity(null); setCreateDefaults(null) }
              }}
              onSelectApiActivity={(activity) => {
                setSelectedApiActivity(activity)
                setCreateDefaults(null)
              }}
              onMembersLoaded={setGanttMembers}
              onColumnsChange={setListColumns}
              triggerNewRow={listNewRowSeq}
            />
          ) : view === 'list' && (!teamId || !activeTimelineId) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading your team…</p>
            </div>
          ) : view === 'calendar' && teamId && activeTimelineId ? (
            <CalendarView
              teamId={teamId}
              timelineId={activeTimelineId}
              layout={calendarLayout}
              anchorDate={calendarAnchorDate}
              colorBy={colorBy}
              timelineStatuses={activeTimelineStatuses}
              savedFilters={savedFilters}
              tags={tags}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => {
                setSelectedActivityId(id)
                if (!id) { setSelectedApiActivity(null); setCreateDefaults(null) }
              }}
              onSelectApiActivity={(activity) => {
                setSelectedApiActivity(activity)
                setCreateDefaults(null)
              }}
              onBarDragProgress={(activityId, newStart, newEnd) => {
                setLiveDragDates({
                  activityId,
                  start: newStart.toISOString().slice(0, 10),
                  end: newEnd.toISOString().slice(0, 10),
                })
              }}
              onBarDragEnd={() => setLiveDragDates(null)}
              onCellClick={(date) => {
                const iso = date.toISOString().slice(0, 10)
                setSelectedActivityId(null)
                setSelectedApiActivity(null)
                setCreateDefaults({ start: iso, end: iso, memberId: null })
              }}
              onMembersLoaded={setGanttMembers}
            />
          ) : view === 'calendar' && (!teamId || !activeTimelineId) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading your team…</p>
            </div>
          ) : view === 'kanban' && teamId && activeTimelineId ? (
            <KanbanView
              teamId={teamId}
              timelineId={activeTimelineId}
              groupBy={kanbanGroupBy}
              sortBy={kanbanSortBy}
              colorBy={kanbanColorBy}
              cardFields={kanbanCardFields}
              collapsedColumnIds={kanbanCollapsedColumns}
              onCollapsedColumnIdsChange={setKanbanCollapsedColumns}
              showHierarchy={kanbanShowHierarchy}
              timelineStatuses={activeTimelineStatuses}
              savedFilters={savedFilters}
              tags={tags}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => {
                setSelectedActivityId(id)
                if (!id) { setSelectedApiActivity(null); setCreateDefaults(null) }
              }}
              onSelectApiActivity={(activity) => {
                setSelectedApiActivity(activity)
                setCreateDefaults(null)
              }}
              onAddActivity={(defaults) => {
                setSelectedActivityId(null)
                setSelectedApiActivity(null)
                setCreateDefaults(defaults)
              }}
              onMembersLoaded={setGanttMembers}
            />
          ) : view === 'kanban' && (!teamId || !activeTimelineId) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>Loading your team…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
                {view.charAt(0).toUpperCase() + view.slice(1)} view coming soon.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activity detail panel — slides in from right when an activity is selected */}
      <ActivityDetailPanel
        open={Boolean(selectedApiActivity)}
        event={selectedApiActivity}
        members={ganttMembers}
        teamId={teamId}
        timelineId={activeTimelineId ?? ''}
        onClose={() => { setSelectedActivityId(null); setSelectedApiActivity(null); setLiveDragDates(null) }}
        liveDragStart={liveDragDates && liveDragDates.activityId === selectedApiActivity?.id ? liveDragDates.start : undefined}
        liveDragEnd={liveDragDates && liveDragDates.activityId === selectedApiActivity?.id ? liveDragDates.end : undefined}
      />

      {/* Activity create panel — slides in from New Activity button or future drag */}
      <ActivityCreatePanel
        open={Boolean(createDefaults) && !selectedApiActivity}
        teamId={teamId}
        timelineId={activeTimelineId ?? ''}
        members={ganttMembers}
        timelineStatuses={activeTimelineStatuses}
        defaultStart={createDefaults?.start ?? new Date().toISOString().slice(0, 10)}
        defaultEnd={createDefaults?.end ?? new Date().toISOString().slice(0, 10)}
        defaultMemberId={createDefaults?.memberId}
        defaultStatusId={createDefaults?.statusId}
        onClose={() => setCreateDefaults(null)}
      />

      <FilterManageModal
        open={filterModalOpen}
        onClose={() => setFilterModalOpen(false)}
        teamId={teamId}
        timelineId={activeTimelineId ?? ''}
        isAdmin={canEditTeam}
      />

      {/* Team modal — create or edit */}
      {teamModalMode && (
        <TeamModal
          mode={teamModalMode}
          team={editingTeam ?? undefined}
          isAdmin={canEditTeam}
          onClose={() => { setTeamModalMode(null); setEditingTeam(null); }}
          onTeamCreated={created => setActiveTeamId(created.id)}
        />
      )}

      {/* Member modal — edit a team member */}
      {editingMember && (
        <MemberModal
          teamId={teamId}
          memberId={editingMember.id}
          isAdmin={canEditTeam}
          isSuperadmin={isSuperadmin}
          onClose={() => setEditingMember(null)}
        />
      )}

      {/* Share modal — create a share link for the active view */}
      {shareModalOpen && activeTimelineId && teamId && (view === 'gantt' || view === 'list' || view === 'kanban') && (
        <ShareModal
          teamId={teamId}
          timelineId={activeTimelineId}
          viewType={view}
          timelineName={activeTimelineName}
          viewConfig={
            view === 'gantt'
              ? { groupBy, sortBy, colorBy, granularity: String(granularity), filter: activeShareFilter }
              : view === 'list'
              ? {
                  groupBy: listGroupBy,
                  sortBy: listSortBy,
                  colorBy: listColorBy,
                  granularity: '',
                  filter: activeShareFilter,
                  columns: listColumns.map(c => ({ id: c.id, visible: c.visible })),
                }
              : {
                  groupBy: kanbanGroupBy,
                  sortBy: kanbanSortBy,
                  colorBy: kanbanColorBy,
                  granularity: '',
                  filter: activeShareFilter,
                  cardFields: kanbanCardFields,
                  showHierarchy: kanbanShowHierarchy,
                  collapsedColumns: kanbanCollapsedColumns,
                }
          }
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/*
        Off-screen PNG capture target — for Gantt/List/Kanban this renders the
        same interactive=false components the public share viewer uses, fed
        with live data, instead of rasterizing the live editable dashboard.
        Calendar has no clean/interactive=false renderer yet (it's only
        shared via ICS feeds, not view-shares — see Phase 13.4), so it falls
        back to capturing the live content area; the PresentationFrame is only
        mounted for the three clean-renderable views.

        PresentationFrame hosts the snapshot in an isolated, always-light
        iframe document (see components/export/PresentationFrame.tsx). That is
        what fixes the dark-mode flicker (the live page's theme is never
        toggled) and the half-dark capture (no `.dark` in scope for the
        snapshot's `var()` colors to resolve against). Mounted only while the
        export dialog is open; on close it unmounts and `snapshotBody` resets.
      */}
      {exportDialogOpen && view !== 'calendar' && (
        <PresentationFrame onReady={handleSnapshotReady}>
          {view === 'gantt' && (
            <CleanGanttSnapshot
              activities={exportFilterInfo.filteredActivities}
              members={ganttMembers}
              statuses={activeTimelineStatuses}
              groupBy={groupBy}
              sortBy={sortBy}
              colorBy={colorBy}
              granularity={granularity}
              startDate={activeTimeline?.startDate}
              endDate={activeTimeline?.endDate}
              weekStart={prefWeekStart}
              locale={prefLocale}
            />
          )}
          {view === 'list' && (
            <CleanListSnapshot
              activities={exportFilterInfo.filteredActivities}
              members={teamMembers}
              statuses={activeTimelineStatuses}
              tags={tags}
              groupBy={listGroupBy}
              sortBy={listSortBy}
              columns={listColumns.map(c => ({ id: c.id, visible: c.visible }))}
            />
          )}
          {view === 'kanban' && (
            <CleanKanbanSnapshot
              activities={exportFilterInfo.filteredActivities}
              teamMembers={teamMembers}
              members={ganttMembers}
              statuses={activeTimelineStatuses}
              tags={tags}
              groupBy={kanbanGroupBy}
              sortBy={kanbanSortBy}
              colorBy={kanbanColorBy}
              cardFields={kanbanCardFields}
              showHierarchy={kanbanShowHierarchy}
              collapsedColumnIds={kanbanCollapsedColumns}
            />
          )}
        </PresentationFrame>
      )}

      {/* Export dialog — download the active view as CSV/Excel/ICS/PNG */}
      {exportDialogOpen && activeTimelineId && teamId && (
        <ExportDialog
          view={view}
          teamId={teamId}
          timelineId={activeTimelineId}
          timelineName={activeTimelineName}
          teamName={activeTeam?.name ?? null}
          filterLabel={exportFilterInfo.filterLabel}
          filterDefinition={exportFilterInfo.filterDefinition}
          filteredCount={exportFilterInfo.filteredCount}
          totalCount={exportFilterInfo.totalCount}
          viewActivityIds={exportViewActivityIds}
          listExportColumns={exportListColumns}
          textExportData={textExportData}
          captureElement={view === 'calendar' ? contentAreaRef.current : snapshotBody}
          periodLabel={view === 'calendar' ? formatAnchorLabel(calendarAnchorDate, calendarLayout) : null}
          onClose={() => { setExportDialogOpen(false); setSnapshotBody(null) }}
        />
      )}

      {/* Calendar share modal — ICS feed configurator (distinct from ShareModal) */}
      {calendarShareModalOpen && activeTimelineId && teamId && (
        <CalendarShareModal
          teamId={teamId}
          timelineId={activeTimelineId}
          timelineName={activeTimelineName}
          onClose={() => setCalendarShareModalOpen(false)}
        />
      )}

      {/* Timeline modal — create or edit */}
      {timelineModalMode && (
        <TimelineModal
          mode={timelineModalMode}
          teamId={teamId}
          timeline={editingTimeline ?? undefined}
          canAdmin={canEditTeam}
          onClose={() => { setTimelineModalMode(null); setEditingTimeline(null) }}
          onCreated={created => setActiveTimelineId(created.id)}
          onUnarchive={id => unarchiveTimeline.mutate(id, { onSuccess: () => { setTimelineModalMode(null); setEditingTimeline(null) } })}
        />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <FindProvider>
      <FilterProvider>
        <DashboardShell />
      </FilterProvider>
    </FindProvider>
  )
}
