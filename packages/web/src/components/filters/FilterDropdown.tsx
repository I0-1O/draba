/**
 * Top-bar filter selector. Surfaces presets, a per-member section, a
 * team-promoted filters section (stub), and the user's saved filters.
 * Selection is stored in FilterContext; wiring to the events list lands
 * when real views render in Phase 8.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Layers, Clock, User, AlertCircle, UserX, CheckCircle,
  ChevronDown, Plus, Check, Settings2,
} from 'lucide-react'
import { useFilter, type ActiveFilter } from '@/contexts/FilterContext'
import { useTeamMembers } from '@/hooks/useTeamActivities'
import { useSavedFilters } from '@/hooks/useSavedFilters'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  teamId?: string
  onOpenEditor: () => void
}

// ── Preset definitions ───────────────────────────────────────────────────────

type PresetId = 'all' | 'upcoming' | 'my' | 'overdue' | 'noassign' | 'open'

interface Preset {
  id: PresetId
  label: string
  icon: React.ReactNode
  subtitle?: string
}

const ICON_PRESET = { size: 14, strokeWidth: 1.8 } as const

const PRESETS: Preset[] = [
  { id: 'all',      label: 'All activities',  icon: <Layers      {...ICON_PRESET} /> },
  { id: 'open',     label: 'Open only',       icon: <CheckCircle {...ICON_PRESET} />, subtitle: 'Hide activities with a closed status' },
  { id: 'upcoming', label: 'Upcoming',         icon: <Clock       {...ICON_PRESET} />, subtitle: 'Starting or ending in 7 days' },
  { id: 'my',       label: 'My events',        icon: <User        {...ICON_PRESET} /> },
  { id: 'overdue',  label: 'Overdue',          icon: <AlertCircle {...ICON_PRESET} /> },
  { id: 'noassign', label: 'No assignee',      icon: <UserX       {...ICON_PRESET} /> },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Narrow TeamMemberWithUser to only those with a real user account. */
function hasUserId<T extends { userId?: string | null }>(m: T): m is T & { userId: string } {
  return typeof m.userId === 'string' && m.userId.length > 0
}

function activeLabel(
  active: ActiveFilter,
  members: { userId: string; displayName: string }[],
  saved: { id: string; name: string }[],
): string {
  if (active.kind === 'preset') return PRESETS.find(p => p.id === active.id)?.label ?? 'Filter'
  if (active.kind === 'member') return members.find(m => m.userId === active.userId)?.displayName ?? 'Member'
  return saved.find(s => s.id === active.id)?.name ?? 'Saved filter'
}

function activeMemberColor(
  active: ActiveFilter,
  members: { userId: string; color?: string | null }[],
): string | null {
  if (active.kind !== 'member') return null
  return members.find(m => m.userId === active.userId)?.color ?? null
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface ItemRowProps {
  icon?: React.ReactNode
  /** Rendered in the 8px-dot slot when provided (overrides icon). */
  dotColor?: string
  label: string
  subtitle?: string
  active: boolean
  /** Gear button shown on hover for custom filters. */
  onConfigure?: () => void
  onClick: () => void
}

function ItemRow({ icon, dotColor, label, subtitle, active, onConfigure, onClick }: ItemRowProps) {
  const [hovered, setHovered] = useState(false)
  const [gearHovered, setGearHovered] = useState(false)

  const rowBg = active
    ? 'rgba(40,140,155,.09)'
    : hovered
    ? 'var(--muted)'
    : 'transparent'

  const labelColor = active ? 'var(--primary)' : 'var(--foreground)'
  const labelWeight = active ? 600 : 400

  const showGear = onConfigure && hovered
  const showCheck = active && !showGear

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 10px 5px 14px',
        background: rowBg,
        cursor: 'pointer',
        transition: 'background 0.08s',
      }}
      onClick={onClick}
    >
      {/* 16px icon / dot slot */}
      <div style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: active ? 'var(--primary)' : 'var(--muted-foreground)' }}>
        {dotColor ? (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
        ) : (
          icon
        )}
      </div>

      {/* Label + subtitle */}
      <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <div style={{
          fontSize: 13,
          fontWeight: labelWeight,
          color: labelColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
          title={label}
        >
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* 24px right slot */}
      <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {showGear ? (
          <button
            onClick={e => { e.stopPropagation(); onConfigure?.() }}
            onMouseEnter={() => setGearHovered(true)}
            onMouseLeave={() => setGearHovered(false)}
            style={{
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: gearHovered ? '#dde2e8' : 'var(--muted, #EDF0F3)',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              transition: 'background 0.1s',
            }}
          >
            <Settings2 size={12} strokeWidth={1.8} />
          </button>
        ) : showCheck ? (
          <Check size={13} strokeWidth={2.5} color="var(--primary)" />
        ) : null}
      </div>
    </div>
  )
}

// ── Section header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string
  teamBadge?: boolean
}

function SectionHeader({ label, teamBadge }: SectionHeaderProps) {
  return (
    <div style={{
      padding: '10px 14px 3px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.8px',
      textTransform: 'uppercase',
      color: 'var(--muted-foreground)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      {label}
      {teamBadge && (
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          color: 'var(--primary)',
          background: 'rgba(40,140,155,.1)',
          border: '1px solid rgba(40,140,155,.25)',
          borderRadius: 99,
          padding: '1px 5px',
          letterSpacing: 0,
          textTransform: 'none',
        }}>
          Team
        </span>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
}

// ── Main component ───────────────────────────────────────────────────────────

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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const membersWithUser = members.filter(hasUserId)
  const label = activeLabel(activeFilter, membersWithUser, saved)
  const memberDotColor = activeMemberColor(activeFilter, membersWithUser)
  const currentUserId = (user as { id?: string } | null)?.id ?? ''

  const isDefaultFilter = activeFilter.kind === 'preset' && activeFilter.id === 'all'

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

  // Trigger appearance — teal tint when a non-default filter is active.
  const triggerBg = isDefaultFilter ? 'transparent' : 'rgba(40,140,155,.09)'
  const triggerBorder = isDefaultFilter ? 'var(--border)' : 'rgba(40,140,155,.22)'
  const triggerColor = isDefaultFilter ? 'var(--foreground)' : 'var(--primary)'
  const triggerWeight = isDefaultFilter ? 400 : 600

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Filter"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          border: `1px solid ${triggerBorder}`,
          borderRadius: 6,
          background: triggerBg,
          color: triggerColor,
          padding: '5px 9px 5px 8px',
          height: 30,
          fontSize: 13,
          fontWeight: triggerWeight,
          maxWidth: 220,
          transition: 'all 0.12s',
        }}
      >
        {/* Icon: colored dot when a member filter is active, otherwise Filter icon */}
        {memberDotColor && !isDefaultFilter ? (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: memberDotColor, flexShrink: 0 }} />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--muted-foreground)' }}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {label}
        </span>
        <ChevronDown size={12} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 284,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,.11), 0 2px 6px rgba(0,0,0,.07)',
            zIndex: 100,
            paddingBottom: 4,
            maxHeight: 460,
            overflowY: 'auto',
          }}
        >
          {/* Presets */}
          <SectionHeader label="Presets" />
          {PRESETS.map(p => {
            const f: ActiveFilter = { kind: 'preset', id: p.id }
            return (
              <ItemRow
                key={p.id}
                icon={p.icon}
                label={p.label}
                subtitle={p.subtitle}
                active={isSelected(f)}
                onClick={() => select(f)}
              />
            )
          })}

          {/* Members */}
          {membersWithUser.length > 0 && (
            <>
              <Divider />
              <SectionHeader label="Members" />
              {membersWithUser.map(m => {
                const f: ActiveFilter = { kind: 'member', userId: m.userId }
                const name = m.userId === currentUserId ? `${m.displayName} (you)` : m.displayName
                return (
                  <ItemRow
                    key={m.userId}
                    dotColor={m.color ?? '#8b949e'}
                    label={name}
                    active={isSelected(f)}
                    onClick={() => select(f)}
                  />
                )
              })}
            </>
          )}

          {/* Team filters — stub; no API support yet */}
          <Divider />
          <SectionHeader label="Team filters" teamBadge />
          <div style={{ padding: '6px 14px 4px', fontSize: 12, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
            No team filters yet
          </div>

          {/* My filters */}
          {saved.length > 0 && (
            <>
              <Divider />
              <SectionHeader label="My filters" />
              {saved.map(s => {
                const f: ActiveFilter = { kind: 'saved', id: s.id }
                return (
                  <ItemRow
                    key={s.id}
                    label={s.name}
                    active={isSelected(f)}
                    onConfigure={() => { onOpenEditor(); setOpen(false) }}
                    onClick={() => select(f)}
                  />
                )
              })}
            </>
          )}

          {/* Footer — add filter */}
          <Divider />
          <AddFilterRow onClick={() => { onOpenEditor(); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

// ── Add filter footer row ─────────────────────────────────────────────────────

function AddFilterRow({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '7px 14px',
        background: hovered ? 'var(--muted)' : 'transparent',
        border: 'none',
        fontSize: 13,
        fontWeight: hovered ? 600 : 400,
        color: hovered ? 'var(--primary)' : 'var(--muted-foreground)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        textAlign: 'left',
        transition: 'all 0.1s',
      }}
    >
      <Plus size={14} strokeWidth={2} />
      Add filter
    </button>
  )
}
