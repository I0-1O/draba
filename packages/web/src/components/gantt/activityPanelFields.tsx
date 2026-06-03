/**
 * Shared field components for the Gantt activity panels.
 *
 * Both ActivityCreatePanel (buffer-and-POST) and ActivityDetailPanel
 * (save-on-change/blur) compose `ActivityFieldsBody` so the two panels show an
 * identical field set, order, and styling. The components are fully controlled
 * — value in, change out — so each panel owns its save strategy: the create
 * panel buffers every change locally and submits once, while the detail panel
 * saves per-field via PATCH. Nothing here knows or cares which.
 */

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ChevronDown, Search } from 'lucide-react'
import MemberAvatar from '@/components/MemberAvatar'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import { resolveColorHex } from '@/components/identity/identity-constants'
import type { Identity } from '@/components/identity/identity-constants'
import TagInput from '@/components/TagInput'
import type { Tag } from '@/hooks/useTags'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']
type Status = components['schemas']['Status']

/** Shared slide-in panel width. */
export const PANEL_WIDTH = 300

// ── Date helpers ──────────────────────────────────────────────────────────────

export function toDateInput(iso: string): string { return iso.slice(0, 10) }
export function toISODate(d: string): string { return `${d}T00:00:00Z` }

// ── Shared styles ─────────────────────────────────────────────────────────────

const SEC_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 3,
  width: 68,
  flexShrink: 0,
}

const STUB_VALUE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted-foreground)',
  opacity: 0.5,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  cursor: 'default',
  userSelect: 'none',
}

const DIVIDER: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  margin: '10px 0',
}

const INPUT: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box' as const,
  fontSize: 12,
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '5px 8px',
  outline: 'none',
  background: 'var(--background)',
  fontFamily: 'var(--font-sans)',
}

// ── Rich status dropdown ──────────────────────────────────────────────────────

interface StatusDropdownProps {
  statuses: Status[]
  value: string | null | undefined
  onChange: (id: string | null) => void
}

export function StatusDropdown({ statuses, value, onChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const selected = statuses.find(s => s.id === value) ?? null

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--background)',
          color: 'var(--foreground)',
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
        }}
      >
        {selected ? (
          <>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: resolveColorHex(selected.color) ?? selected.color,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>— No status —</span>
        )}
        <ChevronDown size={11} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,.12)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--muted-foreground)',
              fontStyle: 'italic',
              cursor: 'pointer',
              borderBottom: statuses.length > 0 ? '1px solid var(--border)' : 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            — No status —
          </div>
          {statuses.map(s => (
            <div
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                fontSize: 12,
                cursor: 'pointer',
                background: s.id === value ? 'var(--muted)' : 'transparent',
                fontWeight: s.id === value ? 600 : 400,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = s.id === value ? 'var(--muted)' : 'transparent')}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: resolveColorHex(s.color) ?? s.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{s.name}</span>
              {s.isClosed && (
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontWeight: 500, letterSpacing: '0.05em' }}>
                  CLOSED
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Searchable parent activity picker ─────────────────────────────────────────

interface ParentPickerProps {
  activities: ApiActivity[]
  value: string | null | undefined
  onChange: (id: string | null) => void
}

/**
 * Searchable combobox for choosing a parent activity. Scales past a plain
 * <select> by filtering as you type, shows each activity's identity badge,
 * and ellipsis-truncates long titles so the panel never overflows.
 */
export function ParentActivityPicker({ activities, value, onChange }: ParentPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Focus the search field whenever the dropdown opens.
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  const selected = activities.find(a => a.id === value) ?? null
  const filtered = activities.filter(a => a.title.toLowerCase().includes(query.trim().toLowerCase()))

  function choose(id: string | null) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--background)', color: 'var(--foreground)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}
      >
        {selected ? (
          <>
            <Badge identity={{ color: selected.color ?? '#288C9B', icon: selected.icon ?? '__none__' }} name={selected.title} size={16} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.title}
            </span>
          </>
        ) : (
          <span style={{ flex: 1, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>— None —</span>
        )}
        <ChevronDown size={11} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 100, overflow: 'hidden',
          }}
        >
          {/* Search field */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <Search size={12} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search activities…"
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'none',
                fontSize: 12, color: 'var(--foreground)', fontFamily: 'var(--font-sans)',
              }}
            />
          </div>

          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            <div
              onClick={() => choose(null)}
              style={{
                padding: '6px 10px', fontSize: 12, color: 'var(--muted-foreground)',
                fontStyle: 'italic', cursor: 'pointer',
                borderBottom: filtered.length > 0 ? '1px solid var(--border)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              — None —
            </div>
            {filtered.map(a => (
              <div
                key={a.id}
                onClick={() => choose(a.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  fontSize: 12, cursor: 'pointer',
                  background: a.id === value ? 'var(--muted)' : 'transparent',
                  fontWeight: a.id === value ? 600 : 400,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = a.id === value ? 'var(--muted)' : 'transparent')}
              >
                <Badge identity={{ color: a.color ?? '#288C9B', icon: a.icon ?? '__none__' }} name={a.title} size={16} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.title}
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                No matching activities
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Progress row (slider + click-to-edit percent label) ───────────────────────

interface ProgressRowProps {
  value: number
  /** Receives the clamped 0–100 integer when the user finishes dragging or typing. */
  onCommit: (val: number) => void
}

function ProgressRow({ value, onCommit }: ProgressRowProps) {
  // Mirror the committed value locally so the slider tracks the drag smoothly.
  const [draftValue, setDraftValue] = useState(value)
  // Percent renders as a label until clicked; `textDraft` holds the in-flight text.
  const [editing, setEditing] = useState(false)
  const [textDraft, setTextDraft] = useState('')

  useEffect(() => { setDraftValue(value) }, [value])

  function clamp(val: number): number {
    return Math.max(0, Math.min(100, Math.round(Number.isFinite(val) ? val : 0)))
  }

  function commit(val: number) {
    const clamped = clamp(val)
    setDraftValue(clamped)
    onCommit(clamped)
  }

  function startEdit() {
    setTextDraft(String(draftValue))
    setEditing(true)
  }

  function commitEdit() {
    commit(textDraft === '' ? 0 : Number(textDraft))
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <span style={FIELD_LABEL}>Progress</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draftValue}
          onChange={e => setDraftValue(Number(e.target.value))}
          onMouseUp={e => commit(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={e => commit(Number((e.target as HTMLInputElement).value))}
          style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--primary)' }}
        />
        {editing ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={textDraft}
            onChange={e => setTextDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              else if (e.key === 'Escape') setEditing(false)
            }}
            aria-label="Percent complete"
            style={{
              width: 40, fontSize: 11, textAlign: 'right', flexShrink: 0,
              marginLeft: 'auto',
              color: 'var(--foreground)', border: '1px solid var(--primary)',
              borderRadius: 4, padding: '2px 4px', outline: 'none',
              background: 'var(--background)', fontFamily: 'var(--font-sans)',
            }}
          />
        ) : (
          <span
            onClick={startEdit}
            title="Click to edit"
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit() } }}
            style={{
              fontSize: 11, color: 'var(--muted-foreground)', minWidth: 34,
              textAlign: 'right', flexShrink: 0, cursor: 'text', userSelect: 'none',
              marginLeft: 'auto',
              padding: '2px 4px', borderRadius: 4, border: '1px solid transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {draftValue}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Composite body ────────────────────────────────────────────────────────────

export interface ActivityFieldsBodyProps {
  // Identity + title
  identity: Identity
  onIdentityChange: (next: Identity) => void
  title: string
  onTitleChange: (value: string) => void
  /** Fired on title blur (detail panel saves here; create panel omits). */
  onTitleBlur?: () => void
  titlePlaceholder?: string
  titleAutoFocus?: boolean
  /** IdentityWidget name fallback shown when the title is empty. */
  titleFallbackName: string

  // When
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void

  // Description
  description: string
  onDescriptionChange: (value: string) => void
  onDescriptionBlur?: () => void

  // Assignees
  members: Member[]
  assignedIds: string[]
  onToggleAssignee: (memberId: string) => void

  // Classify
  statuses: Status[]
  statusId: string | null
  onStatusChange: (id: string | null) => void
  teamId: string
  teamTags: Tag[]
  tagIds: string[]
  onTagsChange: (ids: string[]) => void

  // Advanced
  /** Candidate parents — caller filters out the current activity for the detail panel. */
  parentActivities: ApiActivity[]
  parentId: string | null
  onParentChange: (id: string | null) => void
  progress: number
  onProgressCommit: (val: number) => void
  location: string
  onLocationChange: (value: string) => void
  onLocationBlur?: () => void
  url: string
  onUrlChange: (value: string) => void
  onUrlBlur?: () => void

  // Notes
  notes: string
  onNotesChange: (value: string) => void
  onNotesBlur?: () => void
}

/**
 * The full scrollable field stack shared by both activity panels, in a fixed
 * order: Identity+Title → When → Description → Assigned to → Classify
 * (Status, Tags) → Advanced (Parent, Progress, Location, URL) → Notes.
 *
 * Callers wrap this in their own header bar and footer.
 */
export function ActivityFieldsBody(props: ActivityFieldsBodyProps) {
  const {
    identity, onIdentityChange, title, onTitleChange, onTitleBlur,
    titlePlaceholder, titleAutoFocus, titleFallbackName,
    startDate, endDate, onStartDateChange, onEndDateChange,
    description, onDescriptionChange, onDescriptionBlur,
    members, assignedIds, onToggleAssignee,
    statuses, statusId, onStatusChange, teamId, teamTags, tagIds, onTagsChange,
    parentActivities, parentId, onParentChange, progress, onProgressCommit,
    location, onLocationChange, onLocationBlur,
    url, onUrlChange, onUrlBlur,
    notes, onNotesChange, onNotesBlur,
  } = props

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>

      {/* 1. Identity widget + Title */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          <IdentityWidget
            identity={identity}
            name={title || titleFallbackName}
            shape="square"
            onChange={onIdentityChange}
          />
        </div>
        <input
          autoFocus={titleAutoFocus}
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          onBlur={e => { onTitleBlur?.(); e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent' }}
          placeholder={titlePlaceholder}
          style={{
            flex: 1, fontSize: 13, fontWeight: 600,
            color: 'var(--foreground)', border: '1px solid transparent',
            borderRadius: 'var(--radius-md)', padding: '5px 6px',
            outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--background)' }}
        />
      </div>

      <div style={DIVIDER} />

      {/* 2. When — date pickers */}
      <div style={{ marginBottom: 12 }}>
        <div style={SEC_LABEL}>When</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date" value={startDate}
            onChange={e => onStartDateChange(e.target.value)}
            style={{ ...INPUT, flex: 1, padding: '5px 6px' }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          <ArrowRight size={11} color="var(--muted-foreground)" strokeWidth={2} style={{ flexShrink: 0 }} />
          <input
            type="date" value={endDate} min={startDate}
            onChange={e => onEndDateChange(e.target.value)}
            style={{ ...INPUT, flex: 1, padding: '5px 6px' }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      <div style={DIVIDER} />

      {/* 3. Description */}
      <div style={{ marginBottom: 12 }}>
        <div style={SEC_LABEL}>Description</div>
        <input
          value={description}
          onChange={e => onDescriptionChange(e.target.value)}
          onBlur={e => { onDescriptionBlur?.(); e.target.style.borderColor = 'var(--border)' }}
          placeholder="Optional description…"
          style={{ ...INPUT, padding: '6px 8px' }}
          onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
        />
      </div>

      <div style={DIVIDER} />

      {/* 4. Assigned to — bordered card style */}
      {members.length > 0 && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={SEC_LABEL}>Assigned to</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {members.map(m => {
                const assigned = assignedIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onToggleAssignee(m.id)}
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

          <div style={DIVIDER} />
        </>
      )}

      {/* 5. Classify — Status (rich dropdown), Tags */}
      <div style={{ marginBottom: 12 }}>
        <div style={SEC_LABEL}>Classify</div>

        {/* Status picker */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={FIELD_LABEL}>Status</span>
          {statuses.length > 0 ? (
            <StatusDropdown statuses={statuses} value={statusId} onChange={onStatusChange} />
          ) : (
            <div style={{ ...STUB_VALUE }}>
              <span style={{ fontSize: 10, opacity: 0.5 }}>No statuses configured</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ ...FIELD_LABEL, paddingTop: 5 }}>Tags</span>
          <TagInput teamId={teamId} tags={teamTags} selectedTagIds={tagIds} onChange={onTagsChange} />
        </div>
      </div>

      <div style={DIVIDER} />

      {/* 6. Advanced — Parent, Progress, Location, URL */}
      <div style={{ marginBottom: 12 }}>
        <div style={SEC_LABEL}>Advanced</div>

        {/* Parent activity picker */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={FIELD_LABEL}>Parent</span>
          <ParentActivityPicker activities={parentActivities} value={parentId} onChange={onParentChange} />
        </div>

        {/* % Complete slider */}
        <ProgressRow value={progress} onCommit={onProgressCommit} />

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span style={FIELD_LABEL}>Location</span>
          <input
            value={location}
            onChange={e => onLocationChange(e.target.value)}
            onBlur={e => { onLocationBlur?.(); e.target.style.borderColor = 'var(--border)' }}
            placeholder="—"
            style={{ ...INPUT, flex: 1, padding: '4px 6px', fontSize: 12 }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
          />
        </div>

        {/* URL */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={FIELD_LABEL}>URL</span>
          <input
            value={url}
            onChange={e => onUrlChange(e.target.value)}
            onBlur={e => { onUrlBlur?.(); e.target.style.borderColor = 'var(--border)' }}
            placeholder="—"
            style={{ ...INPUT, flex: 1, padding: '4px 6px', fontSize: 12 }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
          />
        </div>
      </div>

      <div style={DIVIDER} />

      {/* 7. Notes — multi-line textarea */}
      <div style={{ marginBottom: 8 }}>
        <div style={SEC_LABEL}>Notes</div>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          onBlur={e => { onNotesBlur?.(); e.target.style.borderColor = 'var(--border)' }}
          placeholder="Add notes…"
          rows={4}
          style={{
            ...INPUT,
            padding: '6px 8px',
            resize: 'vertical',
            minHeight: 72,
            lineHeight: 1.5,
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
        />
      </div>

    </div>
  )
}
