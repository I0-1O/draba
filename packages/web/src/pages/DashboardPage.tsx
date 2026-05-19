/**
 * Main application shell: sidebar + top bar + content area.
 *
 * Fetches the authenticated user's first team and first timeline to seed the
 * initial view. Team-selection UI and full sidebar wiring come in a later phase.
 */

import { useState, useRef, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar, { type ViewMode } from '@/components/layout/TopBar'
import RightSidebar from '@/components/layout/RightSidebar'
import GanttView from '@/components/gantt/GanttView'
import GanttToolbar, { type GroupBy, type SortBy, type TimeGranularity } from '@/components/gantt/GanttToolbar'
import { FilterProvider } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { useMyTeams, useTeamTimelines, useInvalidateTeamEvents } from '@/hooks/useTeamEvents'
import { useWebSocket } from '@/hooks/useWebSocket'

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
  const { isDark, toggle: toggleDark } = useDarkMode()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<ViewMode>('gantt')
  const [profileOpen, setProfileOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [activeTimelineColor, setActiveTimelineColor] = useState('#1A97A2')
  const [filterEditorOpen, setFilterEditorOpen] = useState(false)
  // Gantt toolbar state
  const [groupBy, setGroupBy] = useState<GroupBy>('none')
  const [sortBy, setSortBy] = useState<SortBy>('startDate')
  const [granularity, setGranularity] = useState<TimeGranularity | 'auto'>('auto')
  const profileRef = useRef<HTMLDivElement>(null)


  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = (user as { displayName?: string } | null)?.displayName ?? 'User'
  const email = (user as { email?: string } | null)?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Use the first team and timeline the user belongs to.
  // Full team-selection UI comes in a later phase.
  const { data: teams = [] } = useMyTeams()
  const teamId = teams[0]?.id ?? ''

  const { data: timelines = [] } = useTeamTimelines(teamId)
  const activeTimeline = timelines[0]

  const invalidateEvents = useInvalidateTeamEvents(teamId)

  useWebSocket({
    token: accessToken,
    teamIds: teamId ? [teamId] : [],
    onMessage: msg => {
      if (msg.type.startsWith('event.')) {
        invalidateEvents()
      }
    },
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        onActiveColorChange={setActiveTimelineColor}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          view={view}
          teamId={teamId}
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
              selectedEventId={selectedEventId}
              onSelectEvent={setSelectedEventId}
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
    <FilterProvider>
      <DashboardShell />
    </FilterProvider>
  )
}
