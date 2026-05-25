/**
 * RoleDropdown — portal-rendered dropdown for selecting a team member's role.
 *
 * Three roles: Admin (teal), Member (muted), Participant (amber — no login).
 * Role changes are applied immediately by the caller; no internal state is kept.
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

export type MemberRole = 'admin' | 'member' | 'participant'

interface Option {
  value: MemberRole
  label: string
  description: string
  color: string
}

const OPTIONS: Option[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full team management — can add/remove members, edit settings.',
    color: '#1A97A2',
  },
  {
    value: 'member',
    label: 'Member',
    description: 'Can view and edit activities.',
    color: '#8b949e',
  },
  {
    value: 'participant',
    label: 'Participant',
    description: 'Login-less member for assignment-only tracking.',
    color: '#F59E0B',
  },
]

interface Props {
  value: MemberRole
  onChange: (role: MemberRole) => void
  /** When true the dropdown is displayed but disabled. */
  disabled?: boolean
  /** Hide the Participant option (used when editing non-participants). */
  hideParticipant?: boolean
}

export default function RoleDropdown({ value, onChange, disabled = false, hideParticipant = false }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  const current = OPTIONS.find(o => o.value === value) ?? OPTIONS[1]
  const visible = hideParticipant ? OPTIONS.filter(o => o.value !== 'participant') : OPTIONS

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!(e.target instanceof Node) || !triggerRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleTrigger() {
    if (disabled) return
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleTrigger}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '3px 8px 3px 10px',
          background: `${current.color}18`,
          border: `1px solid ${current.color}44`,
          borderRadius: 99,
          color: current.color,
          fontSize: 12, fontWeight: 600,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily: 'inherit',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {current.label}
        {!disabled && <ChevronDown size={11} strokeWidth={2.5} />}
      </button>

      {open && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,.5)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {visible.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                width: '100%', padding: '10px 14px',
                background: opt.value === value ? `${opt.color}14` : 'none',
                border: 'none',
                borderLeft: opt.value === value ? `3px solid ${opt.color}` : '3px solid transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}
              onMouseEnter={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (opt.value !== value) (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: opt.color }}>{opt.label}</span>
              <span style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{opt.description}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
