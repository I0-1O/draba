/**
 * Top-bar filter selector. Surfaces presets (All / Upcoming / My events),
 * a dynamic per-team-member section, and the calling user's saved filters.
 * "New filter…" and "Manage filters…" open the right-sidebar editor.
 *
 * The selection is stored in FilterContext but not yet applied to the
 * events list — wiring lands when real views render in Phase 8.
 */

import { useEffect, useRef, useState } from 'react'
import { Filter, ChevronDown, Plus, Settings2 } from 'lucide-react'
import { useFilter, type ActiveFilter } from '@/contexts/FilterContext'
import { useTeamMembers } from '@/hooks/useTeamEvents'
import { useSavedFilters } from '@/hooks/useSavedFilters'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  teamId?: string
  onOpenEditor: () => void
}

const PRESETS: { id: 'all' | 'upcoming' | 'my'; label: string }[] = [
  { id: 'all', label: 'All events' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'my', label: 'My events' },
]

const ROW_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  fontSize: 13,
  color: 'var(--foreground)',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  textAlign: 'left',
}

const SECTION_HEADER: React.CSSProperties = {
  padding: '8px 12px 4px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--muted-foreground)',
}

function activeLabel(active: ActiveFilter, members: { userId: string; displayName: string }[], saved: { id: string; name: string }[]): string {
  if (active.kind === 'preset') return PRESETS.find(p => p.id === active.id)?.label ?? 'Filter'
  if (active.kind === 'member') return members.find(m => m.userId === active.userId)?.displayName ?? 'Member'
  return saved.find(s => s.id === active.id)?.name ?? 'Saved'
}

/** Narrow TeamMemberWithUser to only those with a real user account (not Participants). */
function hasUserId<T extends { userId?: string | null }>(m: T): m is T & { userId: string } {
  return typeof m.userId === 'string' && m.userId.length > 0
}

export default function FilterDropdown({ teamId = '', onOpenEditor }: Props) {
  const { activeFilter, setActiveFilter } = useFilter()
  const { user } = useAuth()
  const { data: members = [] } = useTeamMembers(teamId)
  const { data: saved = [] } = useSavedFilters(teamId)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Participants have no userId; omit them from the per-member filter list.
  const membersWithUser = members.filter(hasUserId)
  const label = activeLabel(activeFilter, membersWithUser, saved)
  const currentUserId = (user as { id?: string } | null)?.id ?? ''

  function select(f: ActiveFilter) {
    setActiveFilter(f)
    setOpen(false)
  }

  function isSelected(f: ActiveFilter): boolean {
    if (f.kind !== activeFilter.kind) return false
    if (f.kind === 'preset' && activeFilter.kind === 'preset') return f.id === activeFilter.id
    if (f.kind === 'member' && activeFilter.kind === 'member') return f.userId === activeFilter.userId
    if (f.kind === 'saved' && activeFilter.kind === 'saved') return f.id === activeFilter.id
    return false
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Filter"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--card)',
          color: 'var(--foreground)',
          padding: '4px 8px 4px 10px',
          height: 28,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <Filter size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{label}</span>
        <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 240,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            zIndex: 100,
            overflow: 'hidden',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={SECTION_HEADER}>Presets</div>
          {PRESETS.map(p => {
            const f: ActiveFilter = { kind: 'preset', id: p.id }
            return (
              <button
                key={p.id}
                onClick={() => select(f)}
                style={{
                  ...ROW_BTN,
                  background: isSelected(f) ? 'var(--muted)' : 'none',
                  fontWeight: isSelected(f) ? 600 : 400,
                }}
                onMouseEnter={e => { if (!isSelected(f)) e.currentTarget.style.background = 'var(--muted)' }}
                onMouseLeave={e => { if (!isSelected(f)) e.currentTarget.style.background = 'none' }}
              >
                {p.label}
              </button>
            )
          })}

          {membersWithUser.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }} />
              <div style={SECTION_HEADER}>Members</div>
              {membersWithUser.map(m => {
                const f: ActiveFilter = { kind: 'member', userId: m.userId }
                const label = m.userId === currentUserId ? `${m.displayName} (you)` : m.displayName
                return (
                  <button
                    key={m.userId}
                    onClick={() => select(f)}
                    style={{
                      ...ROW_BTN,
                      background: isSelected(f) ? 'var(--muted)' : 'none',
                      fontWeight: isSelected(f) ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!isSelected(f)) e.currentTarget.style.background = 'var(--muted)' }}
                    onMouseLeave={e => { if (!isSelected(f)) e.currentTarget.style.background = 'none' }}
                  >
                    Events for {label}
                  </button>
                )
              })}
            </>
          )}

          {saved.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }} />
              <div style={SECTION_HEADER}>Saved filters</div>
              {saved.map(s => {
                const f: ActiveFilter = { kind: 'saved', id: s.id }
                return (
                  <button
                    key={s.id}
                    onClick={() => select(f)}
                    style={{
                      ...ROW_BTN,
                      background: isSelected(f) ? 'var(--muted)' : 'none',
                      fontWeight: isSelected(f) ? 600 : 400,
                    }}
                    onMouseEnter={e => { if (!isSelected(f)) e.currentTarget.style.background = 'var(--muted)' }}
                    onMouseLeave={e => { if (!isSelected(f)) e.currentTarget.style.background = 'none' }}
                  >
                    {s.name}
                  </button>
                )
              })}
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }} />
          <button
            onClick={() => { onOpenEditor(); setOpen(false) }}
            style={ROW_BTN}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Plus size={13} strokeWidth={1.8} />
            New filter…
          </button>
          <button
            onClick={() => { onOpenEditor(); setOpen(false) }}
            style={{ ...ROW_BTN, color: 'var(--muted-foreground)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <Settings2 size={13} strokeWidth={1.8} />
            Manage filters…
          </button>
        </div>
      )}
    </div>
  )
}
