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
import EventDetailPanel from '@/components/gantt/EventDetailPanel'
import EventCreatePanel from '@/components/gantt/EventCreatePanel'
import { FilterProvider } from '@/contexts/FilterContext'
import { FindProvider, useFind } from '@/contexts/FindContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { usePreferences, usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { useMyTeams, useTeamTimelines, useTeamEventSync } from '@/hooks/useTeamEvents'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiEvent = components['schemas']['Event']

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
  const { isDark, toggle: toggleDark, theme } = useDarkMode()
  const { setFindBarOpen } = useFind()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<ViewMode>('gantt')
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedApiEvent, setSelectedApiEvent] = useState<ApiEvent | null>(null)
  const [ganttMembers, setGanttMembers] = useState<Member[]>([])
  const [createDefaults, setCreateDefaults] = useState<{ start: string; end: string; memberId: string | null } | null>(null)
  const [activeTimelineColor, setActiveTimelineColor] = useState('#1A97A2')
  const [activeTimelineName, setActiveTimelineName] = useState('Q1 2027 Roadmap')
  const [filterEditorOpen, setFilterEditorOpen] = useState(false)
  // Gantt toolbar state
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortBy, setSortBy] = useState<SortBy>('startDate')
  const [granularity, setGranularity] = useState<TimeGranularity | 'auto'>('auto')
  const [colorBy, setColorBy] = useState<ColorBy>('event')
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
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Global preferences — restored on login to seed team/timeline selection.
  const { isSuccess: globalPrefsSettled } = usePreferences()
  const globalPrefMap = usePreferenceMap()

  // Use the first team the user belongs to.
  // Full team-selection UI comes in a later phase; selected_team is persisted
  // now so that phase can restore it without a migration.
  const { data: teams = [] } = useMyTeams()
  const teamId = teams[0]?.id ?? ''

  const { data: timelines = [] } = useTeamTimelines(teamId)
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

  useTeamEventSync(teamId, accessToken)

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
        activeTimelineId={activeTimelineId}
        onActiveTimelineChange={handleTimelineChange}
        onNewEvent={() => {
          const today = new Date().toISOString().slice(0, 10)
          setSelectedEventId(null)
          setSelectedApiEvent(null)
          setFilterEditorOpen(false)
          setCreateDefaults({ start: today, end: today, memberId: null })
        }}
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
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  border: 'none',
                  color: 'white',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {initials}
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
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                setSelectedEventId(id)
                if (!id) { setSelectedApiEvent(null); setCreateDefaults(null) }
              }}
              onSelectApiEvent={(ev) => {
                setSelectedApiEvent(ev)
                setCreateDefaults(null)
                if (ev) setFilterEditorOpen(false)
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

      {/* Event detail panel — slides in from right when an event is selected */}
      <EventDetailPanel
        open={Boolean(selectedApiEvent)}
        event={selectedApiEvent}
        members={ganttMembers}
        teamId={teamId}
        onClose={() => { setSelectedEventId(null); setSelectedApiEvent(null) }}
      />

      {/* Event create panel — slides in from New Event button or future drag */}
      <EventCreatePanel
        open={Boolean(createDefaults) && !selectedApiEvent}
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
