/**
 * TimelineModal — create / edit a timeline.
 *
 * Modes:
 *  - "new":  name, identity, date range, description, notes; template picker seeds statuses
 *  - "edit": same fields; plus Statuses tab (add/edit/delete live statuses)
 */

import { useState } from 'react'
import { X, Plus, Trash2, Check, Archive, RotateCcw } from 'lucide-react'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { resolveColorHex } from '@/components/identity/identity-constants'
import {
  useCreateTimeline,
  useUpdateTimeline,
  useDeleteTimeline,
  useArchiveTimeline,
} from '@/hooks/useTeamActivities'
import {
  useTimelineStatuses,
  useCreateTimelineStatus,
  useUpdateTimelineStatus,
  useDeleteTimelineStatus,
} from '@/hooks/useStatusTemplates'
import { useStatusTemplates } from '@/hooks/useStatusTemplates'
import InlineEditableTitle from '@/components/shared/InlineEditableTitle'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import type { components } from '@draba/shared'

type Timeline = components['schemas']['Timeline']
type Status = components['schemas']['Status']

// ── Prop types ────────────────────────────────────────────────────────────────

interface Props {
  mode: 'new' | 'edit'
  teamId: string
  timeline?: Timeline
  canAdmin?: boolean
  onClose: () => void
  onCreated?: (timeline: Timeline) => void
  onUnarchive?: (timelineId: string) => void
}

type Tab = 'settings' | 'statuses'

// ── Inline styles ─────────────────────────────────────────────────────────────

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
  zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const PANEL: React.CSSProperties = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 12, width: 560, maxWidth: '95vw',
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
}

const HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '18px 20px 14px', borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const TAB_BAR: React.CSSProperties = {
  display: 'flex', gap: 2, padding: '0 20px',
  borderBottom: '1px solid var(--border)', flexShrink: 0,
}

const CONTENT: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '20px',
}

const FOOTER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
}

const INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontSize: 13, color: 'var(--foreground)',
  border: '1px solid var(--border)', borderRadius: 6,
  padding: '7px 10px', background: 'var(--background)',
  outline: 'none',
}

const TEXTAREA: React.CSSProperties = {
  ...INPUT,
  resize: 'vertical' as const,
  minHeight: 68,
  fontFamily: 'var(--font-sans)',
  lineHeight: 1.5,
}

const archiveBtnStyle: React.CSSProperties = {
  fontSize: 12, color: '#F59E0B', background: 'rgba(245,158,11,0.12)',
  border: '1px solid rgba(245,158,11,0.35)', borderRadius: 7,
  padding: '7px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  display: 'flex', alignItems: 'center', gap: 6,
}

const restoreBtnStyle: React.CSSProperties = {
  fontSize: 12, color: '#1A97A2', background: 'rgba(26,151,162,0.12)',
  border: '1px solid rgba(26,151,162,0.35)', borderRadius: 7,
  padding: '7px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  display: 'flex', alignItems: 'center', gap: 6,
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', fontSize: 12, fontWeight: 500,
    border: 'none', background: 'none', cursor: 'pointer',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
    fontFamily: 'var(--font-sans)',
  }
}

// ── Status row (edit mode) ────────────────────────────────────────────────────

interface StatusRowProps {
  status: Status
  canDelete: boolean
  teamId: string
  timelineId: string
  allStatuses: Status[]
}

function StatusRow({ status, canDelete, teamId, timelineId, allStatuses }: StatusRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(status.name)
  const [identity, setIdentity] = useState<Identity>({ color: status.color, icon: status.icon ?? '' })
  const [isClosed, setIsClosed] = useState(status.isClosed)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [replacementId, setReplacementId] = useState('')
  const update = useUpdateTimelineStatus(teamId, timelineId)
  const del = useDeleteTimelineStatus(teamId, timelineId)

  function save() {
    update.mutate(
      { id: status.id, name: name.trim() || status.name, color: identity.color, icon: identity.icon || null, isClosed },
      { onSuccess: () => setEditing(false) },
    )
  }

  function doDelete() {
    del.mutate(
      { id: status.id, replacementStatusId: replacementId || undefined },
      { onSuccess: () => setShowDeleteConfirm(false) },
    )
  }

  if (showDeleteConfirm) {
    const others = allStatuses.filter(s => s.id !== status.id)
    return (
      <div style={{ background: 'var(--muted)', borderRadius: 8, padding: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--foreground)', marginBottom: 8 }}>
          Delete <strong>{status.name}</strong>? Activities using this status will be reassigned.
        </div>
        {others.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <label style={{ ...FIELD_LABEL }}>Move activities to</label>
            <select
              value={replacementId}
              onChange={e => setReplacementId(e.target.value)}
              style={{ ...INPUT, fontSize: 12 }}
            >
              <option value="">— No status —</option>
              {others.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowDeleteConfirm(false)} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'none', cursor: 'pointer', color: 'var(--foreground)' }}>Cancel</button>
          <button onClick={doDelete} style={{ fontSize: 12, padding: '4px 10px', border: 'none', borderRadius: 5, background: 'var(--destructive)', color: 'white', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 12px', marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IdentityWidget
            identity={{ color: identity.color, icon: identity.icon ?? '' }}
            name={name || status.name}
            onChange={setIdentity}
            shape="square"
          />
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            style={{ ...INPUT, flex: 1 }}
          />
          <button onClick={save} disabled={update.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4 }}>
            <Check width={14} height={14} />
          </button>
          <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
            <X width={14} height={14} />
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer', userSelect: 'none', paddingLeft: 26 }}>
          <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} />
          Closed status (marks this status as completed/done)
        </label>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <Badge identity={{ color: status.color, icon: status.icon ?? '__none__' }} name={status.name} shape="square" size={18} />
      <span style={{ fontSize: 13, flex: 1, cursor: 'pointer', color: 'var(--foreground)' }} onClick={() => setEditing(true)}>
        {status.name}
      </span>
      {status.isClosed && (
        <span style={{ fontSize: 10, padding: '1px 6px', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--muted-foreground)' }}>closed</span>
      )}
      <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, opacity: 0.5 }}>
        ✎
      </button>
      {canDelete && (
        <button onClick={() => setShowDeleteConfirm(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
          <Trash2 width={13} height={13} />
        </button>
      )}
    </div>
  )
}

// ── Add-status form ───────────────────────────────────────────────────────────

interface AddStatusFormProps {
  teamId: string
  timelineId: string
  primaryColor: string
}

function AddStatusForm({ teamId, timelineId, primaryColor }: AddStatusFormProps) {
  const [expanding, setExpanding] = useState(false)
  const [name, setName] = useState('')
  const [identity, setIdentity] = useState<Identity>({ color: primaryColor, icon: '' })
  const [isClosed, setIsClosed] = useState(false)
  const createStatus = useCreateTimelineStatus(teamId, timelineId)

  function handleAdd() {
    if (!name.trim()) return
    createStatus.mutate(
      { name: name.trim(), color: identity.color, icon: identity.icon || null, isClosed },
      {
        onSuccess: () => {
          setName('')
          setIdentity({ color: primaryColor, icon: '' })
          setIsClosed(false)
          setExpanding(false)
        },
      },
    )
  }

  function handleCancel() {
    setExpanding(false)
    setName('')
    setIdentity({ color: primaryColor, icon: '' })
    setIsClosed(false)
  }

  if (!expanding) {
    return (
      <button
        onClick={() => setExpanding(true)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 12, padding: '4px 2px', fontFamily: 'var(--font-sans)' }}
      >
        <Plus width={13} height={13} /> Add status
      </button>
    )
  }

  return (
    <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 12px', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IdentityWidget identity={identity} name={name || 'New status'} shape="square" onChange={setIdentity} />
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') handleCancel() }}
          placeholder="Status name…"
          style={{ ...INPUT, flex: 1 }}
        />
        <button onClick={handleAdd} disabled={!name.trim() || createStatus.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4, display: 'flex' }}>
          <Check width={14} height={14} />
        </button>
        <button onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, display: 'flex' }}>
          <X width={14} height={14} />
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted-foreground)', cursor: 'pointer', userSelect: 'none', paddingLeft: 26 }}>
        <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} />
        Closed status (marks this status as completed/done)
      </label>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function TimelineModal({ mode, teamId, timeline, canAdmin = false, onClose, onCreated, onUnarchive }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [name, setName] = useState(timeline?.name ?? '')
  const [description, setDescription] = useState(timeline?.description ?? '')
  const [notes, setNotes] = useState(timeline?.notes ?? '')
  const [startDate, setStartDate] = useState(timeline?.startDate ?? '')
  const [endDate, setEndDate] = useState(timeline?.endDate ?? '')
  const [identity, setIdentity] = useState<Identity>({ color: timeline?.color ?? '#1A97A2', icon: timeline?.icon ?? '' })
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  const createTimeline = useCreateTimeline(teamId)
  const updateTimeline = useUpdateTimeline(teamId)
  const deleteTimeline = useDeleteTimeline(teamId)
  const archiveTimeline = useArchiveTimeline(teamId)

  const { data: statuses = [] } = useTimelineStatuses(teamId, timeline?.id ?? '')
  const { data: templates = [] } = useStatusTemplates(teamId)

  const timelineColor = resolveColorHex(identity.color) ?? identity.color ?? '#1A97A2'

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!startDate || !endDate) { setError('Start and end dates are required'); return }
    if (endDate < startDate) { setError('End date must not be before start date'); return }
    setSaving(true)
    setError('')

    if (mode === 'new') {
      createTimeline.mutate(
        {
          name: name.trim(),
          startDate,
          endDate,
          color: identity.color || null,
          icon: identity.icon || null,
          description: description.trim() || null,
          notes: notes.trim() || null,
          templateId: selectedTemplateId || null,
        },
        {
          onSuccess: (tl) => { setSaving(false); onCreated?.(tl); onClose() },
          onError: () => { setSaving(false); setError('Failed to create timeline') },
        },
      )
    } else if (timeline) {
      updateTimeline.mutate(
        {
          timelineId: timeline.id,
          patch: {
            name: name.trim(),
            startDate,
            endDate,
            color: identity.color || null,
            icon: identity.icon || null,
            description: description.trim() || null,
            notes: notes.trim() || null,
          },
        },
        {
          onSuccess: () => { setSaving(false); onClose() },
          onError: () => { setSaving(false); setError('Failed to save timeline') },
        },
      )
    }
  }

  return (
    <div style={OVERLAY}>
      <div style={PANEL} onClick={e => e.stopPropagation()}>
        {/* Header — identity widget + editable name */}
        <div style={HEADER}>
          <IdentityWidget
            identity={identity}
            name={name || (mode === 'new' ? 'New timeline' : timeline?.name ?? '')}
            onChange={setIdentity}
            shape="square"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {mode === 'new' ? 'NEW TIMELINE' : 'EDIT TIMELINE'}
            </div>
            <InlineEditableTitle
              value={name}
              onChange={v => { setName(v); setError('') }}
              placeholder="Timeline name"
              autoFocus={mode === 'new'}
            />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
            <X width={18} height={18} />
          </button>
        </div>

        {/* Tab bar — Statuses tab only in edit mode */}
        <div style={TAB_BAR}>
          <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>Settings</button>
          {mode === 'edit' && (
            <button style={tabStyle(activeTab === 'statuses')} onClick={() => setActiveTab('statuses')}>
              Statuses {statuses.length > 0 && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>({statuses.length})</span>}
            </button>
          )}
        </div>

        {/* Content */}
        <div style={CONTENT}>
          {/* Archive confirmation — replaces tab content */}
          {showArchiveConfirm && timeline ? (
            <ConfirmDialog
              variant="amber"
              icon={<Archive size={22} color="#F59E0B" />}
              title="Archive timeline?"
              body={`${timeline.name} will be hidden from the active list. All data is preserved and can be restored via the Archived section in the sidebar.`}
              confirmLabel="Archive timeline"
              busy={archiveTimeline.isPending}
              onCancel={() => setShowArchiveConfirm(false)}
              onConfirm={() => archiveTimeline.mutate(timeline.id, { onSuccess: onClose })}
            />
          ) : showDeleteConfirm && timeline ? (
            <ConfirmDialog
              variant="red"
              icon={<Trash2 size={22} color="#EF4444" />}
              title="Delete timeline?"
              body={`This permanently deletes ${timeline.name} and all its statuses. Activities are not deleted — they remain in the team.`}
              confirmLabel="Delete timeline"
              busy={deleteTimeline.isPending}
              onCancel={() => setShowDeleteConfirm(false)}
              onConfirm={() => deleteTimeline.mutate(timeline.id, { onSuccess: onClose })}
            />
          ) : activeTab === 'settings' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Date range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={FIELD_LABEL}>Start date *</div>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={INPUT} />
                </div>
                <div>
                  <div style={FIELD_LABEL}>End date *</div>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={INPUT} />
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={FIELD_LABEL}>Description</div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short description of this timeline's purpose…"
                  style={TEXTAREA}
                />
              </div>

              {/* Notes */}
              <div>
                <div style={FIELD_LABEL}>Notes</div>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes, links, references…"
                  style={TEXTAREA}
                />
              </div>

              {/* Template picker (create mode only) */}
              {mode === 'new' && templates.length > 0 && (
                <div>
                  <div style={FIELD_LABEL}>Status template</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {templates.map(tpl => {
                      const isSelected = selectedTemplateId === tpl.id || (!selectedTemplateId && tpl === templates[0])
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => setSelectedTemplateId(tpl.id)}
                          style={{
                            border: `1px solid ${isSelected ? timelineColor + '88' : 'var(--border)'}`,
                            borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                            background: isSelected ? timelineColor + '11' : 'var(--muted)',
                            transition: 'all 0.1s',
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--foreground)' }}>{tpl.name}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {tpl.items.map(item => (
                              <span key={item.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: item.color + '22', border: `1px solid ${item.color}66`, color: item.color }}>
                                {item.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Archived banner */}
              {mode === 'edit' && timeline?.archivedAt && (
                <div style={{ fontSize: 12, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '8px 12px' }}>
                  This timeline is archived. It is hidden from the active list.
                </div>
              )}

              {error && (
                <div style={{ fontSize: 12, color: 'var(--destructive)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px' }}>
                  {error}
                </div>
              )}
            </div>
          ) : (
            activeTab === 'statuses' && timeline && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
                  Statuses are specific to this timeline. Add, rename, recolor, or remove them here.
                </div>

                <div style={{ marginBottom: 4 }}>
                  {statuses.map(s => (
                    <StatusRow
                      key={s.id}
                      status={s}
                      canDelete={statuses.length > 1}
                      teamId={teamId}
                      timelineId={timeline.id}
                      allStatuses={statuses}
                    />
                  ))}
                </div>

                <AddStatusForm teamId={teamId} timelineId={timeline.id} primaryColor={timelineColor} />
              </div>
            )
          )}
        </div>

        {/* Footer — hidden when a confirm dialog is showing */}
        {!showArchiveConfirm && !showDeleteConfirm && (
          <div style={FOOTER}>
            <div style={{ display: 'flex', gap: 8 }}>
              {mode === 'edit' && timeline && canAdmin && !timeline.archivedAt && (
                <button onClick={() => setShowArchiveConfirm(true)} style={archiveBtnStyle}>
                  <Archive size={13} />
                  Archive
                </button>
              )}
              {mode === 'edit' && timeline && canAdmin && timeline.archivedAt && onUnarchive && (
                <button onClick={() => onUnarchive(timeline.id)} style={restoreBtnStyle}>
                  <RotateCcw size={13} />
                  Restore
                </button>
              )}
              {mode === 'edit' && timeline && canAdmin && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ fontSize: 12, padding: '7px 12px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, background: 'none', color: 'var(--destructive)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  Delete
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={onClose}
                style={{ fontSize: 13, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--muted-foreground)' }}
              >
                Cancel
              </button>
              {activeTab === 'settings' && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ fontSize: 13, fontWeight: 600, padding: '8px 18px', border: 'none', borderRadius: 7, background: timelineColor, color: 'white', cursor: saving ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}
                >
                  {saving ? 'Saving…' : mode === 'new' ? 'Create timeline' : 'Save changes'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
