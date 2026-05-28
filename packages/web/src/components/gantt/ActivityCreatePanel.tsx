/**
 * ActivityCreatePanel — right-side slide-in panel for creating a new Gantt activity.
 *
 * Defaults come from the drag selection: start/end date and the lane member.
 * Submits via POST /timelines/:id/activities.
 */

import { useState, useEffect } from 'react'
import { X, ArrowRight, Loader2 } from 'lucide-react'
import MemberAvatar from '@/components/MemberAvatar'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import type { Identity } from '@/components/identity/identity-constants'
import { useCreateActivity } from '@/hooks/useTeamActivities'
import type { Member } from '@/types'

const PANEL_WIDTH = 300

interface Props {
  open: boolean
  teamId: string
  timelineId: string
  members: Member[]
  defaultStart: string
  defaultEnd: string
  defaultMemberId?: string | null
  onClose: () => void
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 4,
}

export default function ActivityCreatePanel({
  open,
  teamId,
  timelineId,
  members,
  defaultStart,
  defaultEnd,
  defaultMemberId,
  onClose,
}: Props) {
  const createMutation = useCreateActivity(teamId, timelineId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [identity, setIdentity] = useState<Identity>({ color: '#288C9B', icon: '__none__' })
  const [assignedIds, setAssignedIds] = useState<string[]>(
    defaultMemberId ? [defaultMemberId] : [],
  )

  // Reset all fields to defaults each time the panel opens so re-opening
  // the panel always shows a blank form rather than the previous session's data.
  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setIdentity({ color: '#288C9B', icon: '__none__' })
    setAssignedIds(defaultMemberId ? [defaultMemberId] : [])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const creating = createMutation.isPending
  const titleTrimmed = title.trim()

  function toggleAssignee(memberId: string) {
    setAssignedIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titleTrimmed) return
    createMutation.mutate(
      {
        title: titleTrimmed,
        startAt: `${startDate}T00:00:00Z`,
        endAt: `${endDate}T00:00:00Z`,
        description: description.trim() || null,
        color: identity.color,
        icon: identity.icon,
        assignedMemberIds: assignedIds,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div
      style={{
        width: open ? PANEL_WIDTH : 0,
        flexShrink: 0,
        borderLeft: open ? '1px solid var(--border)' : 'none',
        background: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
    <div style={{ width: PANEL_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 'var(--topbar-h, 40px)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>New activity</span>
        <button
          onClick={onClose}
          style={{
            width: 24, height: 24, border: 'none', background: 'none', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--muted-foreground)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Title */}
        <div>
          <div style={LABEL}>Title <span style={{ color: 'var(--destructive)' }}>*</span></div>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Activity title…"
            style={{
              width: '100%', boxSizing: 'border-box',
              fontSize: 13, fontWeight: 600, color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '6px 8px', outline: 'none', background: 'var(--background)',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Description */}
        <div>
          <div style={LABEL}>Description</div>
          <textarea
            value={description}
            rows={3}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description…"
            style={{
              width: '100%', boxSizing: 'border-box',
              fontSize: 12, color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              padding: '6px 8px', outline: 'none', background: 'var(--background)',
              resize: 'vertical', lineHeight: 1.5, fontFamily: 'var(--font-sans)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Date range */}
        <div>
          <div style={LABEL}>Date range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
              style={{
                flex: 1, fontSize: 12, color: 'var(--foreground)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                padding: '6px 8px', outline: 'none', background: 'var(--background)',
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            />
            <ArrowRight size={11} color="var(--muted-foreground)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                flex: 1, fontSize: 12, color: 'var(--foreground)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                padding: '6px 8px', outline: 'none', background: 'var(--background)',
                fontFamily: 'var(--font-sans)', cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Identity (color + icon) */}
        <div>
          <div style={LABEL}>Identity</div>
          <IdentityWidget
            identity={identity}
            name={title || 'New Activity'}
            shape="square"
            onChange={setIdentity}
          />
        </div>

        {/* Assignees */}
        {members.length > 0 && (
          <div>
            <div style={LABEL}>Assignees</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => {
                const assigned = assignedIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAssignee(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 8px',
                      border: assigned ? `1px solid ${m.color}` : '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      background: assigned ? `${m.color}18` : 'var(--background)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                  >
                    <MemberAvatar member={m} size={18} />
                    <span style={{ fontSize: 12, color: 'var(--foreground)', flex: 1 }}>{m.name}</span>
                    {assigned && (
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Spacer pushes submit to bottom */}
        <div style={{ flex: 1 }} />
      </form>

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          type="submit"
          form=""
          onClick={handleSubmit}
          disabled={!titleTrimmed || creating}
          style={{
            width: '100%', fontSize: 13, fontWeight: 600, padding: 8,
            borderRadius: 'var(--radius-md)', border: 'none',
            background: titleTrimmed && !creating ? 'var(--primary)' : 'var(--muted)',
            color: titleTrimmed && !creating ? 'white' : 'var(--muted-foreground)',
            cursor: titleTrimmed && !creating ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.1s',
          }}
        >
          {creating && <Loader2 size={13} className="animate-spin" />}
          Create activity
        </button>
      </div>
    </div>
    </div>
  )
}
