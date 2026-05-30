/**
 * ActivityDetailPanel — right-side slide-in panel for a selected Gantt activity.
 *
 * Field order (top to bottom):
 *   1. Header — Identity widget + Title
 *   2. When — Date pickers (start → end)
 *   3. Description — single-line input
 *   4. Assigned to — bordered card style (matches create panel)
 *   5. Classify — Status (rich dropdown with color dot + icon + name), Tags (stub)
 *   6. Advanced — Parent (stub), Progress (stub), Location, URL
 *   7. Notes — multi-line textarea
 *   8. Footer — Delete button
 *
 * All functional fields save on change/blur via PATCH /activities/:id.
 * liveDragStart / liveDragEnd display live dates during bar drag without triggering saves.
 */

import { useState, useEffect, useRef } from 'react'
import { X, Trash2, ArrowRight, Loader2, ChevronDown, Search } from 'lucide-react'
import MemberAvatar from '@/components/MemberAvatar'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import { resolveColorHex } from '@/components/identity/identity-constants'
import type { Identity } from '@/components/identity/identity-constants'
import { useUpdateActivity, useDeleteActivity, useTimelineActivities } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import { useTags } from '@/hooks/useTags'
import TagInput from '@/components/TagInput'
import type { components } from '@draba/shared'
import type { Member } from '@/types'

type ApiActivity = components['schemas']['Activity']
type Status = components['schemas']['Status']

const PANEL_WIDTH = 300

interface Props {
  event: ApiActivity | null
  open: boolean
  members: Member[]
  teamId: string
  timelineId: string
  onClose: () => void
  /** Display-only start date override during bar drag (YYYY-MM-DD). Does not trigger a save. */
  liveDragStart?: string
  /** Display-only end date override during bar drag (YYYY-MM-DD). Does not trigger a save. */
  liveDragEnd?: string
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function toDateInput(iso: string): string { return iso.slice(0, 10) }
function toISODate(d: string): string { return `${d}T00:00:00Z` }

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

function StatusDropdown({ statuses, value, onChange }: StatusDropdownProps) {
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
function ParentActivityPicker({ activities, value, onChange }: ParentPickerProps) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivityDetailPanel({
  event, open, members, teamId, timelineId, onClose, liveDragStart, liveDragEnd,
}: Props) {
  const updateMutation = useUpdateActivity(timelineId)
  const deleteMutation = useDeleteActivity(timelineId)
  const { data: statuses = [] } = useTimelineStatuses(teamId, timelineId)
  const { data: teamTags = [] } = useTags(teamId)
  const { data: allActivities = [] } = useTimelineActivities(teamId, timelineId)

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [startDate, setStartDate] = useState(event ? toDateInput(event.startAt) : '')
  const [endDate, setEndDate] = useState(event ? toDateInput(event.endAt) : '')
  const [identity, setIdentity] = useState<Identity>({
    color: event?.color ?? '#288C9B',
    icon: event?.icon ?? '__none__',
  })
  const [assignedIds, setAssignedIds] = useState<string[]>(event?.assignedMemberIds ?? [])
  const [tagIds, setTagIds] = useState<string[]>((event?.tagIds as string[] | undefined) ?? [])
  const [location, setLocation] = useState(event?.location ?? '')
  const [url, setUrl] = useState(event?.url ?? '')
  const [progressValue, setProgressValue] = useState(event?.percentComplete ?? 0)
  // Parent and status are mirrored locally so the picker reflects a change
  // immediately — the `event` prop is a snapshot taken at selection time and
  // doesn't refresh until the activity is reselected.
  const [parentId, setParentId] = useState<string | null>(event?.parentActivityId ?? null)
  const [statusId, setStatusId] = useState<string | null>(event?.statusId ?? null)
  // Progress percent renders as a label until clicked; `progressDraft` holds the
  // in-flight text while editing.
  const [editingProgress, setEditingProgress] = useState(false)
  const [progressDraft, setProgressDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Re-sync when the selected activity changes.
  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setDescription(event.description ?? '')
    setNotes(event.notes ?? '')
    setStartDate(toDateInput(event.startAt))
    setEndDate(toDateInput(event.endAt))
    setIdentity({ color: event.color ?? '#288C9B', icon: event.icon ?? '__none__' })
    setAssignedIds(event.assignedMemberIds ?? [])
    setTagIds((event.tagIds as string[] | undefined) ?? [])
    setLocation(event.location ?? '')
    setUrl(event.url ?? '')
    setProgressValue(event.percentComplete ?? 0)
    setParentId(event.parentActivityId ?? null)
    setStatusId(event.statusId ?? null)
    setEditingProgress(false)
    setConfirmDelete(false)
  }, [event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local date state when the event's dates change (e.g. after a drag commit).
  const eventStartAt = event?.startAt
  const eventEndAt = event?.endAt
  useEffect(() => {
    if (eventStartAt) setStartDate(toDateInput(eventStartAt))
    if (eventEndAt) setEndDate(toDateInput(eventEndAt))
  }, [eventStartAt, eventEndAt])

  const saving = updateMutation.isPending
  const deleting = deleteMutation.isPending

  // Display dates: live drag overrides take precedence while dragging.
  const displayStart = liveDragStart ?? startDate
  const displayEnd = liveDragEnd ?? endDate

  function save(patch: Parameters<typeof updateMutation.mutate>[0]['patch']) {
    if (!event) return
    updateMutation.mutate({ activityId: event.id, patch })
  }

  function handleTitleBlur() {
    if (title.trim() && title !== event?.title) save({ title: title.trim() })
  }

  function handleDescriptionBlur() {
    if (description !== (event?.description ?? '')) save({ description: description || null })
  }

  function handleNotesBlur() {
    if (notes !== (event?.notes ?? '')) save({ notes: notes || null } as Parameters<typeof save>[0])
  }

  function handleLocationBlur() {
    if (location !== (event?.location ?? '')) save({ location: location || null })
  }

  function handleUrlBlur() {
    if (url !== (event?.url ?? '')) save({ url: url || null })
  }

  function handleStartDateChange(val: string) {
    setStartDate(val)
    if (val && val <= endDate) save({ startAt: toISODate(val) })
  }

  function handleEndDateChange(val: string) {
    setEndDate(val)
    if (val && val >= startDate) save({ endAt: toISODate(val) })
  }

  function handleIdentityChange(next: Identity) {
    setIdentity(next)
    save({ color: next.color, icon: next.icon })
  }

  function toggleAssignee(memberId: string) {
    const next = assignedIds.includes(memberId)
      ? assignedIds.filter(id => id !== memberId)
      : [...assignedIds, memberId]
    setAssignedIds(next)
    save({ assignedMemberIds: next })
  }

  function handleTagsChange(ids: string[]) {
    setTagIds(ids)
    save({ tagIds: ids } as Parameters<typeof save>[0])
  }

  function handleProgressChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProgressValue(Number(e.target.value))
  }

  // Clamps to 0–100, rounds to an integer, and saves only on a real change.
  function commitProgress(val: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(val) ? val : 0)))
    setProgressValue(clamped)
    if (clamped !== (event?.percentComplete ?? 0)) {
      save({ percentComplete: clamped } as Parameters<typeof save>[0])
    }
  }

  function handleProgressCommit(e: React.ChangeEvent<HTMLInputElement>) {
    commitProgress(Number(e.target.value))
  }

  function startEditProgress() {
    setProgressDraft(String(progressValue))
    setEditingProgress(true)
  }

  function commitProgressEdit() {
    commitProgress(progressDraft === '' ? 0 : Number(progressDraft))
    setEditingProgress(false)
  }

  function handleDelete() {
    if (!event) return
    deleteMutation.mutate(event.id, { onSuccess: onClose })
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
        {!event ? null : (<>

        {/* ── Header bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', height: 'var(--topbar-h, 40px)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Activity detail</span>
            {saving && <Loader2 size={11} style={{ opacity: 0.5 }} className="animate-spin" />}
          </div>
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

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>

          {/* 1. Identity widget + Title */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ marginTop: 2, flexShrink: 0 }}>
              <IdentityWidget
                identity={identity}
                name={title || event?.title || ''}
                shape="square"
                onChange={handleIdentityChange}
              />
            </div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              style={{
                flex: 1, fontSize: 13, fontWeight: 600,
                color: 'var(--foreground)', border: '1px solid transparent',
                borderRadius: 'var(--radius-md)', padding: '5px 6px',
                outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.background = 'var(--background)' }}
              onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent' }}
            />
          </div>

          <div style={DIVIDER} />

          {/* 2. When — date pickers only (no allDay checkbox, no date summary) */}
          <div style={{ marginBottom: 12 }}>
            <div style={SEC_LABEL}>When</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="date" value={displayStart}
                onChange={e => handleStartDateChange(e.target.value)}
                style={{ ...INPUT, flex: 1, padding: '5px 6px' }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <ArrowRight size={11} color="var(--muted-foreground)" strokeWidth={2} style={{ flexShrink: 0 }} />
              <input
                type="date" value={displayEnd} min={startDate}
                onChange={e => handleEndDateChange(e.target.value)}
                style={{ ...INPUT, flex: 1, padding: '5px 6px' }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div style={DIVIDER} />

          {/* 3. Description — below dates, matching create panel */}
          <div style={{ marginBottom: 12 }}>
            <div style={SEC_LABEL}>Description</div>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={e => { handleDescriptionBlur(); e.target.style.borderColor = 'var(--border)' }}
              placeholder="Optional description…"
              style={{ ...INPUT, padding: '6px 8px' }}
              onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            />
          </div>

          <div style={DIVIDER} />

          {/* 4. Assigned to — bordered card style matching create panel */}
          {members.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={SEC_LABEL}>Assigned to</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {members.map(m => {
                  const assigned = assignedIds.includes(m.id)
                  return (
                    <button
                      key={m.id}
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

          <div style={DIVIDER} />

          {/* 5. Classify — Status (rich dropdown), Tags (stub) */}
          <div style={{ marginBottom: 12 }}>
            <div style={SEC_LABEL}>Classify</div>

            {/* Status picker */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={FIELD_LABEL}>Status</span>
              {statuses.length > 0 ? (
                <StatusDropdown
                  statuses={statuses}
                  value={statusId}
                  onChange={id => { setStatusId(id); save({ statusId: id } as Parameters<typeof save>[0]) }}
                />
              ) : (
                <div style={{ ...STUB_VALUE }}>
                  <span style={{ fontSize: 10, opacity: 0.5 }}>No statuses configured</span>
                </div>
              )}
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ ...FIELD_LABEL, paddingTop: 5 }}>Tags</span>
              <TagInput
                teamId={teamId}
                tags={teamTags}
                selectedTagIds={tagIds}
                onChange={handleTagsChange}
              />
            </div>
          </div>

          <div style={DIVIDER} />

          {/* 6. Advanced (was "Details") — Parent, Progress, Location, URL */}
          <div style={{ marginBottom: 12 }}>
            <div style={SEC_LABEL}>Advanced</div>

            {/* Parent activity picker */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={FIELD_LABEL}>Parent</span>
              <ParentActivityPicker
                activities={allActivities.filter(a => a.id !== event.id)}
                value={parentId}
                onChange={id => { setParentId(id); save({ parentActivityId: id } as Parameters<typeof save>[0]) }}
              />
            </div>

            {/* % Complete slider */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={FIELD_LABEL}>Progress</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressValue}
                  onChange={handleProgressChange}
                  onMouseUp={handleProgressCommit as unknown as React.MouseEventHandler}
                  onTouchEnd={handleProgressCommit as unknown as React.TouchEventHandler}
                  style={{ flex: 1, cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                {editingProgress ? (
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={progressDraft}
                    onChange={e => setProgressDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    onBlur={commitProgressEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitProgressEdit()
                      else if (e.key === 'Escape') setEditingProgress(false)
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
                    onClick={startEditProgress}
                    title="Click to edit"
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditProgress() } }}
                    style={{
                      fontSize: 11, color: 'var(--muted-foreground)', minWidth: 34,
                      textAlign: 'right', flexShrink: 0, cursor: 'text', userSelect: 'none',
                      marginLeft: 'auto',
                      padding: '2px 4px', borderRadius: 4, border: '1px solid transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {progressValue}%
                  </span>
                )}
              </div>
            </div>

            {/* Location (functional) */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <span style={FIELD_LABEL}>Location</span>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                onBlur={handleLocationBlur}
                placeholder="—"
                style={{ ...INPUT, flex: 1, padding: '4px 6px', fontSize: 12 }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlurCapture={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {/* URL (functional) */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={FIELD_LABEL}>URL</span>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="—"
                style={{ ...INPUT, flex: 1, padding: '4px 6px', fontSize: 12 }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlurCapture={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>
          </div>

          <div style={DIVIDER} />

          {/* 7. Notes — multi-line textarea */}
          <div style={{ marginBottom: 8 }}>
            <div style={SEC_LABEL}>Notes</div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={e => { handleNotesBlur(); e.target.style.borderColor = 'var(--border)' }}
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

        {/* ── Footer — Delete button ── */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.4 }}>
                Delete <strong style={{ color: 'var(--foreground)' }}>{event?.title}</strong>? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 600, padding: 7,
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--card)', color: 'var(--foreground)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 600, padding: 7,
                    borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--destructive)', color: 'white',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontSize: 12, fontWeight: 600, padding: 7,
                borderRadius: 'var(--radius-md)', border: 'none',
                background: 'hsl(0 72% 95%)', color: 'var(--destructive)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              <Trash2 size={12} strokeWidth={2} />
              Delete activity
            </button>
          )}
        </div>

        </>)}
      </div>
    </div>
  )
}
