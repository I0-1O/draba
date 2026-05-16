/**
 * Main application shell: sidebar + top bar + content area.
 *
 * The team ID is hard-coded to a placeholder until team-selection UI is
 * implemented in a later phase. WebSocket subscribes to that team and
 * invalidates the events query on any event delta.
 */

import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar, { type ViewMode, type ZoomLevel } from '@/components/layout/TopBar'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { useTeamEvents, useTeamMembers, useInvalidateTeamEvents } from '@/hooks/useTeamEvents'
import { useWebSocket } from '@/hooks/useWebSocket'

// Placeholder — replaced when team-selection is wired in a future phase.
const PLACEHOLDER_TEAM_ID = ''

export default function DashboardPage() {
  const { logout, accessToken } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [view, setView] = useState<ViewMode>('timeline')
  const [zoom, setZoom] = useState<ZoomLevel>('week')

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
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Action bar strip above the TopBar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '6px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
            flexShrink: 0,
          }}
        >
          <DarkModeToggle />
          <button
            onClick={logout}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Sign out
          </button>
        </div>

        <TopBar
          title="Timeline"
          dateRangeLabel="May 2026"
          view={view}
          zoom={zoom}
          onViewChange={setView}
          onZoomChange={setZoom}
          onPrev={() => {}}
          onNext={() => {}}
          onToday={() => {}}
        />

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
    </div>
  )
}
