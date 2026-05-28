/**
 * TimelineModal — create / edit a timeline.
 *
 * Modes:
 *  - "new":  name + date range + identity; template picker seeds the initial statuses
 *  - "edit": same fields; plus Statuses tab (add/edit/delete live statuses) and
 *            Access tab (grant/revoke member access)
 */

import { useState, useRef } from 'react'
import { X, Plus, Trash2, Check, AlertTriangle } from 'lucide-react'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { resolveColorHex } from '@/components/identity/identity-constants'
import {
  useCreateTimeline,
  useUpdateTimeline,
  useDeleteTimeline,
  useArchiveTimeline,
  useTimelineAccess,
  useGrantTimelineAccess,
  useRevokeTimelineAccess,
  useTeamMembers,
} from '@/hooks/useTeamActivities'
import {
  useTimelineStatuses,
  useCreateTimelineStatus,
  useUpdateTimelineStatus,
  useDeleteTimelineStatus,
} from '@/hooks/useStatusTemplates'
import { useStatusTemplates } from '@/hooks/useStatusTemplates'
import type { components } from '@draba/shared'

type Timeline = components['schemas']['Timeline']
type Status = components['schemas']['Status']
type TimelineAccessEntry = components['schemas']['TimelineAccessEntry']

// ── Prop types ────────────────────────────────────────────────────────────────

interface Props {
  mode: 'new' | 'edit'
  teamId: string
  timeline?: Timeline
  onClose: () => void
  onCreated?: (timeline: Timeline) => void
}

type Tab = 'settings' | 'statuses' | 'access'

// ── Inline styles (matching Team Modal aesthetic) ─────────────────────────────

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <IdentityWidget
          identity={{ color: identity.color, icon: identity.icon ?? '' }}
          name={status.name}
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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer' }}>
          <input type="checkbox" checked={isClosed} onChange={e => setIsClosed(e.target.checked)} />
          closed
        </label>
        <button onClick={save} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4 }}>
          <Check width={14} height={14} />
        </button>
        <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
          <X width={14} height={14} />
        </button>
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

// ── Access row (edit mode) ────────────────────────────────────────────────────

interface AccessRowProps {
  entry: TimelineAccessEntry
  teamId: string
  timelineId: string
  isCurrentUser: boolean
}

function AccessRow({ entry, teamId, timelineId, isCurrentUser }: AccessRowProps) {
  const grant = useGrantTimelineAccess(teamId, timelineId)
  const revoke = useRevokeTimelineAccess(teamId, timelineId)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
      <Badge
        identity={{ color: entry.color ?? '#8b949e', icon: entry.icon ?? '__name_words__' }}
        name={entry.displayName || entry.email}
        shape="circle"
        size={24}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.displayName || entry.email}
        </div>
        {entry.email && entry.displayName && (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{entry.email}</div>
        )}
      </div>
      <select
        value={entry.role}
        disabled={isCurrentUser}
        onChange={e => grant.mutate({ memberId: entry.teamMemberId, role: e.target.value as 'admin' | 'member' })}
        style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', background: 'var(--card)', color: 'var(--foreground)', cursor: isCurrentUser ? 'default' : 'pointer' }}
      >
        <option value="admin">Admin</option>
        <option value="member">Member</option>
      </select>
      {!isCurrentUser && (
        <button
          onClick={() => revoke.mutate(entry.teamMemberId)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}
        >
          <X width={13} height={13} />
        </button>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function TimelineModal({ mode, teamId, timeline, onClose, onCreated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [name, setName] = useState(timeline?.name ?? '')
  const [startDate, setStartDate] = useState(timeline?.startDate ?? '')
  const [endDate, setEndDate] = useState(timeline?.endDate ?? '')
  const [identity, setIdentity] = useState<Identity>({ color: timeline?.color ?? '#1A97A2', icon: timeline?.icon ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [newStatusName, setNewStatusName] = useState('')
  const [addingMemberId, setAddingMemberId] = useState('')

  const createTimeline = useCreateTimeline(teamId)
  const updateTimeline = useUpdateTimeline(teamId)
  const deleteTimeline = useDeleteTimeline(teamId)
  const archiveTimeline = useArchiveTimeline(teamId)

  const { data: statuses = [] } = useTimelineStatuses(teamId, timeline?.id ?? '')
  const createStatus = useCreateTimelineStatus(teamId, timeline?.id ?? '')
  const { data: accessEntries = [] } = useTimelineAccess(teamId, timeline?.id ?? '')
  const { data: allMembers = [] } = useTeamMembers(teamId)
  const grantAccess = useGrantTimelineAccess(teamId, timeline?.id ?? '')

  const { data: templates = [] } = useStatusTemplates(teamId)

  const overlayRef = useRef<HTMLDivElement>(null)
  const timelineColor = resolveColorHex(identity.color) ?? identity.color ?? '#1A97A2'

  // Grant access affordance — members not yet on the access list.
  const accessedMemberIds = new Set(accessEntries.map(e => e.teamMemberId))
  const unlistedMembers = allMembers.filter(m => !accessedMemberIds.has(m.id))

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose()
  }

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    if (!startDate || !endDate) { setError('Start and end dates are required'); return }
    if (endDate < startDate) { setError('End date must not be before start date'); return }
    setSaving(true)
    setError('')

    if (mode === 'new') {
      createTimeline.mutate(
        { name: name.trim(), startDate, endDate, color: identity.color || null, icon: identity.icon || null },
        {
          onSuccess: (tl) => { setSaving(false); onCreated?.(tl); onClose() },
          onError: () => { setSaving(false); setError('Failed to create timeline') },
        },
      )
    } else if (timeline) {
      updateTimeline.mutate(
        { timelineId: timeline.id, patch: { name: name.trim(), startDate, endDate, color: identity.color || null, icon: identity.icon || null } },
        {
          onSuccess: () => { setSaving(false); onClose() },
          onError: () => { setSaving(false); setError('Failed to save timeline') },
        },
      )
    }
  }

  function handleAddStatus() {
    if (!newStatusName.trim() || !timeline) return
    createStatus.mutate(
      { name: newStatusName.trim() },
      { onSuccess: () => setNewStatusName('') },
    )
  }

  function handleGrantMember() {
    if (!addingMemberId || !timeline) return
    grantAccess.mutate(
      { memberId: addingMemberId, role: 'member' },
      { onSuccess: () => setAddingMemberId('') },
    )
  }

  if (showDeleteConfirm && timeline) {
    return (
      <div style={OVERLAY} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={{ ...PANEL, maxWidth: 440 }}>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle width={22} height={22} color="var(--destructive)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Delete timeline?</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.5 }}>
              This permanently deletes <strong>{timeline.name}</strong> and all its statuses. Activities are not deleted — they remain in the team.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button
                onClick={() => deleteTimeline.mutate(timeline.id, { onSuccess: onClose })}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 7, background: 'var(--destructive)', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Delete timeline
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showArchiveConfirm && timeline) {
    return (
      <div style={OVERLAY} ref={overlayRef} onClick={handleOverlayClick}>
        <div style={{ ...PANEL, maxWidth: 440 }}>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle width={22} height={22} color="#F59E0B" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Archive timeline?</div>
            <div style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 24, lineHeight: 1.5 }}>
              <strong>{timeline.name}</strong> will be hidden from the active list. All data is preserved and the timeline can be restored from the Archived section in the sidebar.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setShowArchiveConfirm(false)} style={{ padding: '8px 18px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button
                onClick={() => archiveTimeline.mutate(timeline.id, { onSuccess: onClose })}
                style={{ padding: '8px 18px', border: 'none', borderRadius: 7, background: '#F59E0B', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Archive timeline
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={OVERLAY} ref={overlayRef} onClick={handleOverlayClick}>
      <div style={PANEL} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={HEADER}>
          <IdentityWidget
            identity={identity}
            name={name || (mode === 'new' ? 'New timeline' : timeline?.name ?? '')}
            onChange={setIdentity}
            shape="square"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              {mode === 'new' ? 'NEW TIMELINE' : 'EDIT TIMELINE'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name || (mode === 'new' ? 'New timeline' : timeline?.name)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}>
            <X width={18} height={18} />
          </button>
        </div>

        {/* Tab bar — only show Statuses and Access tabs in edit mode */}
        <div style={TAB_BAR}>
          <button style={tabStyle(activeTab === 'settings')} onClick={() => setActiveTab('settings')}>Settings</button>
          {mode === 'edit' && (
            <>
              <button style={tabStyle(activeTab === 'statuses')} onClick={() => setActiveTab('statuses')}>
                Statuses {statuses.length > 0 && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>({statuses.length})</span>}
              </button>
              <button style={tabStyle(activeTab === 'access')} onClick={() => setActiveTab('access')}>
                Access {accessEntries.length > 0 && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.6 }}>({accessEntries.length})</span>}
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div style={CONTENT}>
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <div style={FIELD_LABEL}>Name *</div>
                <input
                  autoFocus={mode === 'new'}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Timeline name"
                  style={INPUT}
                />
              </div>

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

              {/* Template picker (create mode only) */}
              {mode === 'new' && templates.length > 0 && (
                <div>
                  <div style={FIELD_LABEL}>Status template</div>
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 8 }}>
                    The team's first template will be copied into this timeline's statuses automatically.
                  </div>
                  <div style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px' }}>
                    {templates[0] && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{templates[0].name}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {templates[0].items.map(item => (
                            <span key={item.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: item.color + '22', border: `1px solid ${item.color}66`, color: item.color }}>
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontSize: 12, color: 'var(--destructive)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 12px' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          {activeTab === 'statuses' && timeline && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
                Statuses are specific to this timeline. Add, rename, recolor, or remove them here.
              </div>

              <div style={{ marginBottom: 12 }}>
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

              {/* Add status */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={newStatusName}
                  onChange={e => setNewStatusName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddStatus() }}
                  placeholder="New status name…"
                  style={{ ...INPUT, flex: 1 }}
                />
                <button
                  onClick={handleAddStatus}
                  disabled={!newStatusName.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'white', cursor: 'pointer', opacity: newStatusName.trim() ? 1 : 0.4 }}
                >
                  <Plus width={13} height={13} /> Add
                </button>
              </div>
            </div>
          )}

          {activeTab === 'access' && timeline && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
                Team admins can always access all timelines. Use this list to grant specific team members access.
              </div>

              <div style={{ marginBottom: 14 }}>
                {accessEntries.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '20px 0' }}>No explicit access grants yet.</div>
                ) : (
                  accessEntries.map(e => (
                    <AccessRow
                      key={e.teamMemberId}
                      entry={e}
                      teamId={teamId}
                      timelineId={timeline.id}
                      isCurrentUser={false}
                    />
                  ))
                )}
              </div>

              {/* Add member */}
              {unlistedMembers.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={addingMemberId}
                    onChange={e => setAddingMemberId(e.target.value)}
                    style={{ ...INPUT, flex: 1, fontSize: 12 }}
                  >
                    <option value="">Add a team member…</option>
                    {unlistedMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.displayName || m.email}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleGrantMember}
                    disabled={!addingMemberId}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: 'var(--primary)', color: 'white', cursor: 'pointer', opacity: addingMemberId ? 1 : 0.4 }}
                  >
                    <Plus width={13} height={13} /> Grant
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={FOOTER}>
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'edit' && timeline && !timeline.archivedAt && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                style={{ fontSize: 12, padding: '7px 12px', border: '1px solid #F59E0B44', borderRadius: 7, background: 'none', color: '#F59E0B', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                Archive
              </button>
            )}
            {mode === 'edit' && timeline && (
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
              style={{ fontSize: 13, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 7, background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Cancel
            </button>
            {(activeTab === 'settings') && (
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
      </div>
    </div>
  )
}
