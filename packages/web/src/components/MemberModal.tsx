/**
 * MemberModal — view and edit a team member's profile, identity, and role.
 *
 * Shows computed stats (timelines, activities by date status) and exposes
 * superadmin actions (promote, inactivate, delete) when the viewer is a
 * superadmin. Password reset is present but shows "SMTP not configured"
 * until Phase 14.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Shield, Archive, Trash2, AlertTriangle, Clock, Activity, Calendar, Users } from 'lucide-react'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import type { Identity } from '@/components/identity/identity-constants'
import { Badge } from '@/components/identity/Badge'
import { useMemberDetail, useUpdateMember, usePromoteUser, useArchiveUser, useUnarchiveUser, useDeleteUser } from '@/hooks/useMemberManagement'
import { useAuth } from '@/contexts/AuthContext'
import type { components } from '@draba/shared'

type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

interface Props {
  teamId: string
  memberId: string
  /** Whether the current viewer is a team admin. */
  isAdmin: boolean
  /** Whether the current viewer is a superadmin. */
  isSuperadmin: boolean
  onClose: () => void
}

// ── Small shared styles ───────────────────────────────────────────────────────

const chipStyle = (color: string): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  padding: '10px 16px', borderRadius: 8, flex: 1,
  border: `1px solid ${color}44`, borderTop: `3px solid ${color}`,
  background: `${color}0a`, textAlign: 'center', minWidth: 0,
})

const cancelBtn: React.CSSProperties = {
  background: 'none', border: '1px solid #30363d', color: '#8b949e',
  fontSize: 13, padding: '7px 18px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
}

interface ConfirmDialogProps {
  variant: 'indigo' | 'amber' | 'red'
  icon: React.ReactNode
  title: string
  body: string
  confirmLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDialog({ variant, icon, title, body, confirmLabel, busy, onCancel, onConfirm }: ConfirmDialogProps) {
  const colors = { indigo: '#6366F1', amber: '#F59E0B', red: '#EF4444' }
  const c = colors[variant]
  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${c}20`, border: `1.5px solid ${c}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, maxWidth: 340 }}>{body}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} disabled={busy} style={cancelBtn}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            background: `${c}22`, border: `1px solid ${c}66`, color: c,
            fontWeight: 600, fontSize: 13, padding: '7px 18px',
            borderRadius: 7, cursor: 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MemberModal({ teamId, memberId, isAdmin, isSuperadmin, onClose }: Props) {
  const { user: currentUser } = useAuth()
  const { data: detail, isLoading, isError } = useMemberDetail(teamId, memberId)
  const updateMember = useUpdateMember(teamId)
  const promoteUser = usePromoteUser()
  const archiveUser = useArchiveUser()
  const unarchiveUser = useUnarchiveUser()
  const deleteUser = useDeleteUser()

  const [identity, setIdentity] = useState<Identity | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'promote' | 'inactivate' | 'delete' | null>(null)

  if (isLoading || isError || !detail) {
    return createPortal(
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      >
        <div style={{ width: 560, height: 300, background: '#21262d', border: '1px solid #30363d', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
          {isError ? (
            <>
              <span style={{ color: '#EF4444', fontSize: 13 }}>Failed to load member — the member may have been removed.</span>
              <button onClick={onClose} style={{ fontSize: 12, color: '#8b949e', background: 'none', border: '1px solid #30363d', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>Dismiss</button>
            </>
          ) : (
            <span style={{ color: '#484f58', fontSize: 13 }}>Loading…</span>
          )}
        </div>
      </div>,
      document.body,
    )
  }

  const effectiveIdentity: Identity = identity ?? {
    color: detail.color ?? '#1A97A2',
    icon: detail.icon ?? '__name_words__',
  }
  const effectiveName = displayName ?? detail.displayName

  const isParticipant = !detail.userId
  const isInactivated = Boolean(detail.archivedAt)
  const stats = detail.stats
  const activeActivityCount = stats.pastDue + stats.running + stats.upcoming + stats.unscheduled

  const busy = updateMember.isPending || promoteUser.isPending || archiveUser.isPending || unarchiveUser.isPending || deleteUser.isPending

  // detail is guaranteed non-null here (early return above handles loading/undefined).
  // Non-null assertions in callbacks are safe because they only fire when the
  // rendered modal is interactive, which requires detail to be loaded.
  function handleSave() {
    const patch: { displayName?: string | null; color?: string | null; icon?: string | null } = {}
    if (displayName !== null) patch.displayName = displayName
    if (identity !== null) { patch.color = identity.color; patch.icon = identity.icon }
    updateMember.mutate({ memberId, patch }, { onSuccess: onClose })
  }

  function handlePromote() {
    if (!detail!.userId) return
    promoteUser.mutate(detail!.userId, { onSuccess: () => setConfirm(null) })
  }

  function handleInactivate() {
    if (!detail!.userId) return
    archiveUser.mutate(detail!.userId, { onSuccess: () => { setConfirm(null); onClose() } })
  }

  function handleReactivate() {
    if (!detail!.userId) return
    unarchiveUser.mutate(detail!.userId, { onSuccess: onClose })
  }

  function handleDelete() {
    if (!detail!.userId) return
    deleteUser.mutate(detail!.userId, { onSuccess: () => { setConfirm(null); onClose() } })
  }

  const memberColor = effectiveIdentity.color

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
    >
      <div style={{ width: 560, maxHeight: '90vh', background: '#21262d', border: '1px solid #30363d', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Confirm overlays */}
        {confirm === 'promote' && (
          <ConfirmDialog
            variant="indigo"
            icon={<Shield size={22} color="#6366F1" />}
            title="Promote to Super Admin?"
            body={`${effectiveName} will gain full administrative access to all teams and settings. This cannot be undone without direct database access.`}
            confirmLabel="Promote"
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={handlePromote}
          />
        )}
        {confirm === 'inactivate' && (
          <ConfirmDialog
            variant="amber"
            icon={<Archive size={22} color="#F59E0B" />}
            title={`Inactivate ${effectiveName}?`}
            body="The account will be disabled. The member will not be able to log in. Their data and activity assignments are preserved and access can be restored at any time."
            confirmLabel="Inactivate"
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={handleInactivate}
          />
        )}
        {confirm === 'delete' && (
          <ConfirmDialog
            variant="red"
            icon={<Trash2 size={22} color="#EF4444" />}
            title={`Delete ${effectiveName}?`}
            body="This permanently removes the user account and cannot be undone. Only allowed when the user has no active activities and belongs to a single team."
            confirmLabel="Delete permanently"
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={handleDelete}
          />
        )}

        {confirm === null && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #30363d', flexShrink: 0 }}>
              <div style={{ flexShrink: 0 }}>
                <IdentityWidget
                  identity={effectiveIdentity}
                  name={effectiveName}
                  shape="circle"
                  onChange={setIdentity}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#484f58', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 3 }}>
                  {isParticipant ? 'Participant' : 'Team Member'}
                  {isInactivated && ' · Inactive'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {(isAdmin || currentUser?.id === detail.userId) ? (
                    <input
                      value={displayName ?? detail.displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      style={{
                        fontSize: 16, fontWeight: 600, color: '#e6edf3',
                        background: 'transparent', border: 'none', outline: 'none',
                        padding: '1px 4px', margin: '-1px -4px',
                        borderRadius: 4, fontFamily: 'inherit',
                        minWidth: 0, flex: 1,
                      }}
                      onFocus={e => { e.currentTarget.style.background = '#2d333b'; e.currentTarget.style.border = '1px solid #30363d' }}
                      onBlur={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = 'none' }}
                    />
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>{effectiveName}</span>
                  )}
                  {isParticipant && (
                    <span style={{ fontSize: 11, fontWeight: 600, background: '#F59E0B20', border: '1px solid #F59E0B44', color: '#F59E0B', borderRadius: 99, padding: '1px 7px', flexShrink: 0 }}>No login</span>
                  )}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', padding: 4, display: 'flex', flexShrink: 0 }}>
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

              {/* Email */}
              {!isParticipant && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Email</label>
                  <div style={{ fontSize: 13, color: '#8b949e', padding: '8px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {detail.email}
                  </div>
                </div>
              )}

              {/* Timeline stats */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                  <Calendar size={11} style={{ display: 'inline', marginRight: 5 }} />
                  Timelines
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={chipStyle('#1A97A2')}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#1A97A2' }}>{stats.activeTimelines}</span>
                    <span style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>Active</span>
                  </div>
                  <div style={chipStyle('#484f58')}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#8b949e' }}>{stats.archivedTimelines}</span>
                    <span style={{ fontSize: 11, color: '#484f58', marginTop: 2 }}>Archived</span>
                  </div>
                </div>
              </div>

              {/* Activity stats */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                  <Activity size={11} style={{ display: 'inline', marginRight: 5 }} />
                  Activities
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={chipStyle(stats.pastDue > 0 ? '#EF4444' : '#484f58')}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: stats.pastDue > 0 ? '#EF4444' : '#8b949e' }}>{stats.pastDue}</span>
                    <span style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>Past due</span>
                  </div>
                  <div style={chipStyle('#1A97A2')}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#1A97A2' }}>{stats.running}</span>
                    <span style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>Running</span>
                  </div>
                  <div style={chipStyle('#3B82F6')}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#3B82F6' }}>{stats.upcoming}</span>
                    <span style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>Upcoming</span>
                  </div>
                  <div style={chipStyle('#484f58')}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#8b949e' }}>{stats.archivedActivities}</span>
                    <span style={{ fontSize: 10, color: '#484f58', marginTop: 2 }}>Archived</span>
                  </div>
                </div>
              </div>

              {/* Teams list */}
              {detail.teams.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                    <Users size={11} style={{ display: 'inline', marginRight: 5 }} />
                    Teams ({detail.teams.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {detail.teams.map((tm: TeamMemberWithUser) => (
                      <div key={tm.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: '#2d333b', borderRadius: 7 }}>
                        <Badge identity={{ color: tm.color ?? '#1A97A2', icon: '__name_1__' }} name={tm.teamId} shape="square" size={20} />
                        <span style={{ fontSize: 13, color: '#e6edf3', flex: 1 }}>{tm.teamId}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: tm.role === 'admin' ? '#1A97A2' : '#8b949e', background: tm.role === 'admin' ? '#1A97A220' : '#2d333b', border: `1px solid ${tm.role === 'admin' ? '#1A97A244' : '#30363d'}`, borderRadius: 99, padding: '1px 8px' }}>
                          {tm.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Joined date */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#2d333b', borderRadius: 6, fontSize: 12, color: '#8b949e' }}>
                  <Clock size={12} />
                  Joined {new Date(detail.joinedAt).toLocaleDateString()}
                </div>
              </div>

              {/* Account section — non-participant only */}
              {!isParticipant && isAdmin && (
                <div style={{ borderTop: '1px solid #30363d', paddingTop: 16, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>Account</label>
                  <button
                    style={{ fontSize: 12, color: '#484f58', background: 'none', border: '1px solid #30363d', borderRadius: 7, padding: '6px 14px', cursor: 'not-allowed', fontFamily: 'inherit' }}
                    title="SMTP is not configured"
                    disabled
                  >
                    Reset password — SMTP not configured
                  </button>
                </div>
              )}

              {/* Superadmin actions */}
              {isSuperadmin && !isParticipant && (
                <div style={{ borderTop: '1px solid #30363d', paddingTop: 16 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 10, display: 'block' }}>
                    <AlertTriangle size={11} style={{ display: 'inline', marginRight: 5 }} />
                    Super Admin Actions
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {!isInactivated && (
                      <button
                        onClick={() => setConfirm('promote')}
                        style={{ fontSize: 12, color: '#6366F1', background: '#6366F114', border: '1px solid #6366F144', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Shield size={13} />
                        Promote to Super Admin
                      </button>
                    )}
                    {isInactivated ? (
                      <button
                        onClick={handleReactivate}
                        disabled={busy}
                        style={{ fontSize: 12, color: '#1A97A2', background: '#1A97A214', border: '1px solid #1A97A244', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
                      >
                        Reactivate account
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirm('inactivate')}
                        style={{ fontSize: 12, color: '#F59E0B', background: '#F59E0B14', border: '1px solid #F59E0B44', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Archive size={13} />
                        Inactivate
                      </button>
                    )}
                    {detail.deletable && (
                      <button
                        onClick={() => setConfirm('delete')}
                        style={{ fontSize: 12, color: '#EF4444', background: '#EF444414', border: '1px solid #EF444444', borderRadius: 7, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </div>
                  {activeActivityCount > 0 && (
                    <div style={{ fontSize: 11, color: '#484f58', marginTop: 8 }}>
                      Member has {activeActivityCount} active {activeActivityCount === 1 ? 'activity' : 'activities'} — remove assignments before deleting.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid #30363d', flexShrink: 0 }}>
              <button onClick={onClose} style={cancelBtn}>Cancel</button>
              {(isAdmin || currentUser?.id === detail.userId) && (
                <button
                  onClick={handleSave}
                  disabled={busy}
                  style={{ background: memberColor, color: '#fff', fontWeight: 600, fontSize: 13, padding: '7px 18px', borderRadius: 7, cursor: 'pointer', border: 'none', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
