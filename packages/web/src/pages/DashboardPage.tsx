/**
 * Main application shell: sidebar + top bar + content area.
 *
 * Fetches the authenticated user's first team and first timeline to seed the
 * initial view. Team-selection UI and full sidebar wiring come in a later phase.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar, { type ViewMode } from '@/components/layout/TopBar'
import RightSidebar from '@/components/layout/RightSidebar'
import GanttView from '@/components/gantt/GanttView'
import GanttToolbar, { type GroupBy, type SortBy, type TimeGranularity, type ColorBy } from '@/components/gantt/GanttToolbar'
import ActivityDetailPanel from '@/components/gantt/ActivityDetailPanel'
import ActivityCreatePanel from '@/components/gantt/ActivityCreatePanel'
import { FilterProvider } from '@/contexts/FilterContext'
import { FindProvider, useFind } from '@/contexts/FindContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { usePreferences, usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { useMyTeams, useTeamTimelines, useTeamTimelinesWithArchived, useTeamActivitySync, useUnarchiveTeam, useUnarchiveTimeline, useTeamMembers } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import TeamModal from '@/components/TeamModal'
import MemberModal from '@/components/MemberModal'
import TimelineModal from '@/components/TimelineModal'
import { useNavigate } from 'react-router-dom'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']
type ApiTeam = components['schemas']['Team']
type ApiTimeline = components['schemas']['Timeline']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

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
  const navigate = useNavigate()
  const { isDark, toggle: toggleDark, theme } = useDarkMode()
  const { setFindBarOpen } = useFind()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<ViewMode>('gantt')
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [selectedApiActivity, setSelectedApiActivity] = useState<ApiActivity | null>(null)
  const [ganttMembers, setGanttMembers] = useState<Member[]>([])
  const [createDefaults, setCreateDefaults] = useState<{ start: string; end: string; memberId: string | null } | null>(null)
  const [activeTimelineColor, setActiveTimelineColor] = useState('#1A97A2')
  const [activeTimelineName, setActiveTimelineName] = useState('Q1 2027 Roadmap')
  const [filterEditorOpen, setFilterEditorOpen] = useState(false)
  // Gantt toolbar state
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortBy, setSortBy] = useState<SortBy>('startDate')
  const [granularity, setGranularity] = useState<TimeGranularity | 'auto'>('auto')
  const [colorBy, setColorBy] = useState<ColorBy>('activity')
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

  // Team modal state
  const [teamModalMode, setTeamModalMode] = useState<'new' | 'edit' | null>(null)
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null)
  const unarchiveTeam = useUnarchiveTeam()

  // Member modal state
  const [editingMember, setEditingMember] = useState<TeamMemberWithUser | null>(null)

  // Timeline modal state
  const [timelineModalMode, setTimelineModalMode] = useState<'new' | 'edit' | null>(null)
  const [editingTimeline, setEditingTimeline] = useState<ApiTimeline | null>(null)
  const unarchiveTimeline = useUnarchiveTimeline(teamId)

  // Hide-closed-statuses toggle (GanttToolbar → GanttView filter)
  const [hideClosed, setHideClosed] = useState(false)

  // Fetch all teams including archived for the sidebar's archived section.
  const { data: allTeams = [] } = useMyTeams(true)
  const activeTeams = allTeams.filter(t => !t.archivedAt)
  const archivedTeams = allTeams.filter(t => Boolean(t.archivedAt))

  // Explicit team selection state — initialized from global prefs or first active team.
  const [activeTeamId, setActiveTeamId] = useState<string>('')
  const teamIdInitialized = useRef(false)
  useEffect(() => {
    if (!activeTeams.length || !globalPrefsSettled || teamIdInitialized.current) return
    teamIdInitialized.current = true
    const saved = typeof globalPrefMap['selected_team'] === 'string' ? globalPrefMap['selected_team'] : null
    const exists = saved && activeTeams.some(t => t.id === saved)
    setActiveTeamId(exists ? saved : activeTeams[0].id)
  }, [activeTeams, globalPrefsSettled, globalPrefMap])

  const activeTeam = activeTeams.find(t => t.id === activeTeamId) ?? activeTeams[0]
  const teamId = activeTeam?.id ?? ''

  // Check whether the current user is an admin of the active team.
  const { data: teamMembers = [] } = useTeamMembers(teamId)
  const userId = (user as { id?: string } | null)?.id ?? ''
  const isSuperadmin = Boolean((user as { isSuperadmin?: boolean } | null)?.isSuperadmin)
  const canEditTeam = isSuperadmin || teamMembers.some(m => m.userId === userId && m.role === 'admin')

  const handleSelectTeam = useCallback((id: string) => {
    setActiveTeamId(id)
  }, [])

  const { data: timelines = [] } = useTeamTimelines(teamId)
  const { data: allTimelines = [] } = useTeamTimelinesWithArchived(teamId)
  const archivedTimelines = allTimelines.filter(t => Boolean(t.archivedAt))
  const { data: activeTimelineStatuses = [] } = useTimelineStatuses(teamId, activeTimelineId ?? '')
  const [activeTimelineId, setActiveTimelineId] = useState<string | undefined>()
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

  const handleTimelineChange = useCallback((id: string) => {
    prefsAppliedForTimeline.current = null
    setActiveTimelineId(id)
  }, [])

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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        onActiveColorChange={setActiveTimelineColor}
        onActiveNameChange={setActiveTimelineName}
        apiTimelines={timelines}
        archivedTimelines={archivedTimelines}
        activeTimelineId={activeTimelineId}
        onActiveTimelineChange={handleTimelineChange}
        onNewTimeline={() => { setEditingTimeline(null); setTimelineModalMode('new') }}
        onEditTimeline={id => {
          const tl = allTimelines.find(t => t.id === id)
          setEditingTimeline(tl ?? null)
          setTimelineModalMode('edit')
        }}
        onUnarchiveTimeline={id => unarchiveTimeline.mutate(id)}
        onNewActivity={() => {
          const today = new Date().toISOString().slice(0, 10)
          setSelectedActivityId(null)
          setSelectedApiActivity(null)
          setFilterEditorOpen(false)
          setCreateDefaults({ start: today, end: today, memberId: null })
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
          onViewChange={setView}
          onOpenFilterEditor={() => setFilterEditorOpen(true)}
          rightSlot={
            <div ref={profileRef} style={{ position: 'relative', marginLeft: 4 }}>
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
            hideClosed={hideClosed}
            onHideClosedChange={activeTimelineStatuses.some(s => s.isClosed) ? setHideClosed : undefined}
            onExport={() => {}}
            onShare={() => {}}
          />
        )}

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {view === 'gantt' && teamId ? (
            <GanttView
              teamId={teamId}
              startDate={activeTimeline?.startDate}
              endDate={activeTimeline?.endDate}
              groupBy={groupBy}
              sortBy={sortBy}
              granularity={granularity}
              colorBy={colorBy}
              hideClosed={hideClosed}
              closedStatusIds={new Set(activeTimelineStatuses.filter(s => s.isClosed).map(s => s.id))}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => {
                setSelectedActivityId(id)
                if (!id) { setSelectedApiActivity(null); setCreateDefaults(null) }
              }}
              onSelectApiActivity={(activity) => {
                setSelectedApiActivity(activity)
                setCreateDefaults(null)
                if (activity) setFilterEditorOpen(false)
              }}
              onMembersLoaded={setGanttMembers}
            />
          ) : view === 'gantt' && !teamId ? (
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
        timelineId={activeTimelineId}
        onClose={() => { setSelectedActivityId(null); setSelectedApiActivity(null) }}
      />

      {/* Activity create panel — slides in from New Activity button or future drag */}
      <ActivityCreatePanel
        open={Boolean(createDefaults) && !selectedApiActivity}
        teamId={teamId}
        members={ganttMembers}
        defaultStart={createDefaults?.start ?? new Date().toISOString().slice(0, 10)}
        defaultEnd={createDefaults?.end ?? new Date().toISOString().slice(0, 10)}
        defaultMemberId={createDefaults?.memberId}
        onClose={() => setCreateDefaults(null)}
      />

      <RightSidebar
        open={filterEditorOpen}
        title="Filter editor"
        onClose={() => setFilterEditorOpen(false)}
      >
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, lineHeight: 1.5 }}>
          Filter editor coming soon.
        </p>
      </RightSidebar>

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

      {/* Timeline modal — create or edit */}
      {timelineModalMode && (
        <TimelineModal
          mode={timelineModalMode}
          teamId={teamId}
          timeline={editingTimeline ?? undefined}
          onClose={() => { setTimelineModalMode(null); setEditingTimeline(null) }}
          onCreated={created => {
            setActiveTimelineId(created.id)
          }}
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
