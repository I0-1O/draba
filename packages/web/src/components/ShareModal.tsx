/**
 * ShareModal — manage the share links for the current timeline view.
 *
 * Rebuilt to the "Share this view" design handoff (docs/design/handoffs/share-modal):
 * an active-links list with per-row creator/date/view-count meta and an inline
 * delete-confirm, plus an inline create form with optional password protection.
 * One timeline can host many named shares; each is a frozen view snapshot.
 *
 * Delete is intentionally not permission-gated — a share is a read-only
 * projection that cannot mutate app data, so any team member may manage any
 * link (Phase 13.2 decision).
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Link as LinkIcon, Link2, Lock, KeyRound, Copy, Check, Eye, EyeOff,
  Trash2, Plus, PlusCircle, X, Users,
} from 'lucide-react'
import { useCreateShare, useListShares, useDeleteShare } from '@/hooks/useShares'
import { useTeamMembers } from '@/hooks/useTeamActivities'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/identity/Badge'
import { resolveColorHex } from '@/components/identity/identity-constants'
import { MEMBER_COLORS } from '@/types'
import type { FilterDefinition } from '@/lib/filterTypes'
import type { components } from '@draba/shared'

type Share = components['schemas']['Share']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

export interface ShareViewConfig {
  groupBy: string
  sortBy: string
  colorBy: string
  granularity: string
  filter: FilterDefinition | null
}

interface Props {
  teamId: string
  timelineId: string
  viewType: 'gantt' | 'list' | 'calendar' | 'kanban'
  viewConfig: ShareViewConfig
  /** Display name of the timeline, shown in the header subtitle. */
  timelineName?: string
  onClose: () => void
}

interface CreatePayload {
  title: string
  description: string
  password: string | null
}

// ── Shared token-styled bits ──────────────────────────────────────────────────

/** Teal tint used for the unprotected link tile / header icon. */
const TEAL_TINT = 'hsl(188 59% 38% / 0.12)'
/** Amber tints used for the protected (password) tile and badge. */
const AMBER_TINT = 'hsl(30 87% 62% / 0.16)'
const AMBER_TINT_STRONG = 'hsl(30 87% 62% / 0.22)'

function MiniAvatar({ member, size = 20 }: { member: TeamMemberWithUser | undefined; size?: number }) {
  if (!member) return null
  const name = member.displayName || 'Team member'
  const color = resolveColorHex(member.color) || MEMBER_COLORS[0]
  return (
    <Badge identity={{ color, icon: member.icon ?? '__name_1__' }} name={name} size={size} shape="circle" />
  )
}

function formatCreated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── A single share row ─────────────────────────────────────────────────────────

function ShareRow({
  share,
  creator,
  isOwn,
  onDelete,
}: {
  share: Share
  creator: TeamMemberWithUser | undefined
  isOwn: boolean
  onDelete: (id: string) => void
}) {
  const url = `${window.location.host}/s/${share.token}`
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const protectedShare = Boolean(share.protected)

  const copy = () => {
    void navigator.clipboard.writeText(`${window.location.origin}/s/${share.token}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: 14, boxShadow: 'var(--shadow-sm)' }}>
      {/* Top: type tile + title + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)', flexShrink: 0,
          background: protectedShare ? AMBER_TINT : TEAL_TINT,
          color: protectedShare ? 'var(--secondary)' : 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {protectedShare ? <Lock size={16} strokeWidth={2.2} /> : <LinkIcon size={16} strokeWidth={2.2} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{share.name || 'Untitled link'}</span>
            {protectedShare && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--secondary-foreground)', background: AMBER_TINT_STRONG, padding: '1px 8px', borderRadius: 'var(--radius-full)' }}>
                <Lock size={10} strokeWidth={2.4} /> password
              </span>
            )}
          </div>
          {share.description && (
            <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 3, lineHeight: 1.45 }}>{share.description}</p>
          )}
        </div>
        <button
          onClick={() => setConfirming(true)}
          title="Delete share"
          style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-md)', border: 'none', background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 72% 51% / 0.1)'; e.currentTarget.style.color = 'var(--destructive)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
        >
          <Trash2 size={15} strokeWidth={2} />
        </button>
      </div>

      {/* URL row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: 'var(--muted)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--foreground)' }}>
          <Link2 size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} strokeWidth={2} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
        </div>
        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 12.5, fontWeight: 600,
            padding: '7px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: `1px solid ${copied ? 'var(--success)' : 'var(--border)'}`,
            background: copied ? 'hsl(145 63% 42% / 0.12)' : 'var(--card)',
            color: copied ? 'var(--success)' : 'var(--foreground)', transition: 'all .15s',
          }}
        >
          {copied ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={2.2} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Footer meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12, color: 'var(--muted-foreground)' }}>
        <MiniAvatar member={creator} size={20} />
        <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
          {creator?.displayName ?? 'Team member'}
          {isOwn && <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}> · you</span>}
        </span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span>{formatCreated(share.createdAt)}</span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Eye size={12} strokeWidth={2} />{share.viewCount} {share.viewCount === 1 ? 'view' : 'views'}
        </span>
      </div>

      {/* Inline delete confirm */}
      {confirming && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', background: 'var(--card)', border: '1px solid var(--destructive)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '14px 16px', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 'var(--radius-md)', background: 'hsl(0 72% 51% / 0.1)', color: 'var(--destructive)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={15} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)' }}>Delete this share?</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Anyone with the link will immediately lose access. This can&apos;t be undone.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirming(false)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { onDelete(share.id); setConfirming(false) }} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--destructive)', color: 'var(--destructive-foreground)', cursor: 'pointer' }}>Delete link</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── The add-share inline form ───────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', fontSize: 13, color: 'var(--foreground)', padding: '8px 11px',
  border: '1px solid var(--input)', borderRadius: 'var(--radius-md)', background: 'var(--card)',
  outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 5,
  display: 'block', letterSpacing: '0.02em',
}
const focusOn = (e: React.FocusEvent<HTMLElement>) => {
  e.target.style.borderColor = 'var(--primary)'
  e.target.style.boxShadow = '0 0 0 2px hsl(188 59% 38% / 0.2)'
}
const focusOff = (e: React.FocusEvent<HTMLElement>) => {
  e.target.style.borderColor = 'var(--input)'
  e.target.style.boxShadow = 'none'
}

function AddShareForm({
  currentMember,
  onCreate,
  onCancel,
  isPending,
  isError,
}: {
  currentMember: TeamMemberWithUser | undefined
  onCreate: (payload: CreatePayload) => void
  onCancel: () => void
  isPending: boolean
  isError: boolean
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [pwOn, setPwOn] = useState(false)
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  const valid = title.trim().length > 0 && (!pwOn || pw.trim().length > 0)

  const submit = () => {
    if (!valid || isPending) return
    onCreate({ title: title.trim(), description: desc.trim(), password: pwOn ? pw : null })
  }

  return (
    <div style={{ border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-lg)', background: 'var(--card)', padding: 16, boxShadow: '0 0 0 3px hsl(188 59% 38% / 0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <PlusCircle size={16} style={{ color: 'var(--primary)' }} strokeWidth={2.2} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)' }}>New share link</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Title</label>
        <input
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="e.g. Acme stakeholder view"
          style={inputBase}
          onFocus={focusOn}
          onBlur={focusOff}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>· optional</span></label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={2}
          placeholder="What's this link for, and who is it shared with?"
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={focusOn}
          onBlur={focusOff}
        />
      </div>

      {/* Password protect */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-md)', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={14} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Password protect</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>Require a password to open the link</div>
          </div>
          <button
            onClick={() => setPwOn(v => !v)}
            role="switch"
            aria-checked={pwOn}
            aria-label="Password protect"
            style={{ width: 40, height: 22, flexShrink: 0, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', background: pwOn ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background .15s', padding: 0 }}
          >
            <span style={{ position: 'absolute', top: 2, left: pwOn ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: 'var(--shadow-sm)' }} />
          </button>
        </div>
        {pwOn && (
          <div style={{ padding: '12px 12px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--input)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
              <KeyRound size={14} style={{ color: 'var(--muted-foreground)' }} strokeWidth={2} />
              <input
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                type={showPw ? 'text' : 'password'}
                placeholder="Set a password"
                style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', padding: '8px 0', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)' }}
              />
              <button onClick={() => setShowPw(v => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4 }}>
                {showPw ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {isError && (
        <p style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 10 }}>Failed to create share. Please try again.</p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>
          <MiniAvatar member={currentMember} size={20} />
          <span>Sharing as {currentMember?.displayName ?? 'you'}</span>
        </div>
        <button onClick={onCancel} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
        <button
          onClick={submit}
          disabled={!valid || isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 'var(--radius-md)', border: 'none', cursor: valid && !isPending ? 'pointer' : 'not-allowed', background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: valid && !isPending ? 1 : 0.45 }}
        >
          <LinkIcon size={14} strokeWidth={2.2} /> {isPending ? 'Creating…' : 'Create link'}
        </button>
      </div>
    </div>
  )
}

// ── The modal shell ──────────────────────────────────────────────────────────

export default function ShareModal({ teamId, timelineId, viewType, viewConfig, timelineName, onClose }: Props) {
  const { user } = useAuth()
  const { data: shares = [], isLoading } = useListShares(teamId, timelineId)
  const { data: members = [] } = useTeamMembers(teamId)
  const createShare = useCreateShare(teamId, timelineId)
  const deleteShare = useDeleteShare(teamId, timelineId)
  const [adding, setAdding] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const memberByID = new Map(members.map(m => [m.id, m]))
  const currentMember = members.find(m => m.userId && m.userId === user?.id)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const configString = JSON.stringify({
    groupBy: viewConfig.groupBy,
    sortBy: viewConfig.sortBy,
    colorBy: viewConfig.colorBy,
    granularity: viewConfig.granularity,
    filter: viewConfig.filter ?? { logic: 'and', conditions: [] },
  })

  const handleCreate = (payload: CreatePayload) => {
    createShare.mutate(
      {
        name: payload.title,
        description: payload.description || null,
        viewType,
        viewConfig: configString,
        password: payload.password ?? undefined,
      },
      {
        onSuccess: () => {
          setAdding(false)
          setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, 0)
        },
      },
    )
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgb(20 28 33 / 0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(580px, 100%)', maxHeight: '88vh', background: 'var(--card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-md)', background: TEAL_TINT, color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LinkIcon size={19} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.25, margin: 0 }}>Share this view</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--secondary)', display: 'inline-block', flexShrink: 0 }} />
              {timelineName ? `${timelineName} · ` : ''}anyone with a link can view
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, flexShrink: 0, border: 'none', background: 'var(--muted)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Section bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 20px 11px', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Active links</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 'var(--radius-full)', padding: '1px 8px', minWidth: 20, textAlign: 'center' }}>{shares.length}</span>
          <div style={{ marginLeft: 'auto' }}>
            {!adding && (
              <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <Plus size={14} strokeWidth={2.4} /> New share
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', minHeight: 120, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {adding && (
            <AddShareForm
              currentMember={currentMember}
              onCreate={handleCreate}
              onCancel={() => setAdding(false)}
              isPending={createShare.isPending}
              isError={createShare.isError}
            />
          )}

          {!isLoading && shares.length === 0 && !adding && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '36px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <LinkIcon size={22} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>No share links yet</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 4, maxWidth: 280 }}>Create a link to let people outside your team view this timeline.</div>
              <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'var(--primary-foreground)', marginTop: 16 }}>
                <Plus size={14} strokeWidth={2.4} /> Create share link
              </button>
            </div>
          )}

          {shares.map(s => (
            <ShareRow
              key={s.id}
              share={s}
              creator={s.createdBy ? memberByID.get(s.createdBy) : undefined}
              isOwn={Boolean(currentMember && s.createdBy === currentMember.id)}
              onDelete={(id) => deleteShare.mutate(id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <Users size={14} strokeWidth={2} />
            Read-only links · anyone on your team can manage them
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
