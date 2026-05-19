/**
 * Main application shell: sidebar + top bar + content area.
 *
 * The team ID is hard-coded to a placeholder until team-selection UI is
 * implemented in a later phase. WebSocket subscribes to that team and
 * invalidates the events query on any event delta.
 */

import { useState, useRef, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar, { type ViewMode } from '@/components/layout/TopBar'
import RightSidebar from '@/components/layout/RightSidebar'
import { FilterProvider } from '@/contexts/FilterContext'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Settings, Moon, Sun, LogOut } from 'lucide-react'
import { useTeamEvents, useTeamMembers, useInvalidateTeamEvents } from '@/hooks/useTeamEvents'
import { useWebSocket } from '@/hooks/useWebSocket'

// Placeholder — replaced when team-selection is wired in a future phase.
const PLACEHOLDER_TEAM_ID = ''

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
  const [view, setView] = useState<ViewMode>('list')
  const [profileOpen, setProfileOpen] = useState(false)
  const [activeTimelineColor, setActiveTimelineColor] = useState('#1A97A2')
  const [filterEditorOpen, setFilterEditorOpen] = useState(false)
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

  const displayName = (user as { displayName?: string } | null)?.displayName ?? 'Lindsay K.'
  const email = (user as { email?: string } | null)?.email ?? 'lk@acme.com'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const teamId = PLACEHOLDER_TEAM_ID

  const { data: events = [], isLoading: eventsLoading } = useTeamEvents(teamId)
  const { data: members = [] } = useTeamMembers(teamId)
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
          onShare={() => {}}
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

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {eventsLoading ? (
            <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Loading events…</p>
          ) : events.length === 0 && teamId === '' ? (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
                No team selected. The timeline view will be wired up in Phase 8.
              </p>
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 8 }}>
                {members.length > 0 ? `${members.length} member(s) loaded.` : ''}
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(ev => (
                <li
                  key={ev.id}
                  style={{
                    padding: '10px 14px',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 13,
                    color: 'var(--foreground)',
                  }}
                >
                  <strong>{ev.title}</strong>{' '}
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {ev.startAt.slice(0, 10)} → {ev.endAt.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
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
