/**
 * ShareModal — manage the share links for the current timeline view.
 *
 * Rebuilt to the "Share this view" design handoff (docs/design/handoffs/share-modal):
 * an active-links list with per-row creator/date/view-count meta and an inline
 * delete-confirm, plus an inline create form with optional password protection.
 * One timeline can host many named shares; each is a frozen view snapshot.
 *
 * Styled with Tailwind utility classes against the project's design tokens
 * (see index.css `@theme`) and shadcn/ui primitives — the handoff is a visual
 * reference, not production code, so its inline styles were not ported.
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
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
  /** List shares only — column visibility snapshot; drives the "notes" projection nuance. */
  columns?: { id: string; visible: boolean }[]
  /** Kanban shares only — which fields render on each card. */
  cardFields?: string[]
  /** Kanban shares only — whether child activities nest under their parent. */
  showHierarchy?: boolean
  /** Kanban shares only — column IDs collapsed at share-creation time. */
  collapsedColumns?: string[]
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
//
// The handoff colors a share's "type tile" teal (open link) or amber
// (password-protected). Those tints aren't semantic tokens on their own, so
// they're expressed as arbitrary-value Tailwind classes derived from the
// existing `--primary` / `--secondary` HSL values rather than ported hex.

const TILE_TEAL = 'bg-[hsl(188_59%_38%/0.12)] text-primary'
const TILE_AMBER = 'bg-[hsl(30_87%_62%/0.16)] text-secondary'
const BADGE_AMBER = 'bg-[hsl(30_87%_62%/0.22)] text-secondary-foreground'

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
    <div className="relative rounded-[var(--radius-lg)] border border-border bg-card p-3.5 shadow-sm">
      {/* Top: type tile + title + delete */}
      <div className="flex items-start gap-2.5">
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]', protectedShare ? TILE_AMBER : TILE_TEAL)}>
          {protectedShare ? <Lock size={16} strokeWidth={2.2} /> : <LinkIcon size={16} strokeWidth={2.2} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{share.name || 'Untitled link'}</span>
            {protectedShare && (
              <span className={cn('inline-flex items-center gap-1 rounded-[var(--radius-full)] px-2 py-px text-[11px] font-semibold', BADGE_AMBER)}>
                <Lock size={10} strokeWidth={2.4} /> password
              </span>
            )}
          </div>
          {share.description && (
            <p className="mt-[3px] text-[12.5px] leading-[1.45] text-muted-foreground">{share.description}</p>
          )}
        </div>
        <button
          onClick={() => setConfirming(true)}
          title="Delete share"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border-none bg-transparent text-muted-foreground transition-colors hover:bg-[hsl(0_72%_51%/0.1)] hover:text-destructive"
        >
          <Trash2 size={15} strokeWidth={2} />
        </button>
      </div>

      {/* URL row */}
      <div className="mt-[11px] flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] bg-muted px-[11px] py-[7px] font-mono text-[12.5px] text-foreground">
          <Link2 size={13} className="shrink-0 text-muted-foreground" strokeWidth={2} />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">{url}</span>
        </div>
        <button
          onClick={copy}
          className={cn(
            'flex shrink-0 items-center gap-[5px] rounded-[var(--radius-md)] border px-3 py-[7px] text-[12.5px] font-semibold transition-colors',
            copied ? 'border-success bg-[hsl(145_63%_42%/0.12)] text-success' : 'border-border bg-card text-foreground',
          )}
        >
          {copied ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={2.2} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Footer meta */}
      <div className="mt-[11px] flex items-center gap-2 text-xs text-muted-foreground">
        <MiniAvatar member={creator} size={20} />
        <span className="font-semibold text-foreground">
          {creator?.displayName ?? 'Team member'}
          {isOwn && <span className="font-normal text-muted-foreground"> · you</span>}
        </span>
        <span className="opacity-50">•</span>
        <span>{formatCreated(share.createdAt)}</span>
        <span className="opacity-50">•</span>
        <span className="inline-flex items-center gap-1">
          <Eye size={12} strokeWidth={2} />{share.viewCount} {share.viewCount === 1 ? 'view' : 'views'}
        </span>
      </div>

      {/* Inline delete confirm */}
      {confirming && (
        <div className="absolute inset-0 flex flex-col justify-center gap-2.5 rounded-[var(--radius-lg)] border border-destructive bg-card px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(0_72%_51%/0.1)] text-destructive">
              <Trash2 size={15} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[13.5px] font-semibold text-foreground">Delete this share?</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Anyone with the link will immediately lose access. This can&apos;t be undone.</div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => { onDelete(share.id); setConfirming(false) }}>Delete link</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── The add-share inline form ───────────────────────────────────────────────────

/**
 * No shadcn Textarea exists yet, so this mirrors Input's class string —
 * keeps the field visually consistent without inline styles.
 */
const TEXTAREA_CLASSES = 'flex w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm leading-relaxed text-[var(--foreground)] shadow-sm transition-colors placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]'

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
    <div className="rounded-[var(--radius-lg)] border-[1.5px] border-primary bg-card p-4 shadow-[0_0_0_3px_hsl(188_59%_38%/0.08)]">
      <div className="mb-3.5 flex items-center gap-2">
        <PlusCircle size={16} className="text-primary" strokeWidth={2.2} />
        <span className="text-[13.5px] font-bold text-foreground">New share link</span>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <Label htmlFor="share-title">Title</Label>
        <Input
          id="share-title"
          ref={titleRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="e.g. Acme stakeholder view"
        />
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <Label htmlFor="share-description">
          Description <span className="lowercase font-normal">· optional</span>
        </Label>
        <textarea
          id="share-description"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={2}
          placeholder="What's this link for, and who is it shared with?"
          className={TEXTAREA_CLASSES}
        />
      </div>

      {/* Password protect */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted text-muted-foreground">
            <Lock size={14} strokeWidth={2} />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-foreground">Password protect</div>
            <div className="text-[11.5px] text-muted-foreground">Require a password to open the link</div>
          </div>
          <button
            onClick={() => setPwOn(v => !v)}
            role="switch"
            aria-checked={pwOn}
            aria-label="Password protect"
            className={cn(
              'relative h-[22px] w-10 shrink-0 cursor-pointer rounded-[var(--radius-full)] border-none p-0 transition-colors',
              pwOn ? 'bg-primary' : 'bg-border',
            )}
          >
            <span className={cn(
              'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left] duration-150',
              pwOn ? 'left-5' : 'left-[2px]',
            )} />
          </button>
        </div>
        {pwOn && (
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-input bg-card px-2.5">
              <KeyRound size={14} className="text-muted-foreground" strokeWidth={2} />
              <input
                value={pw}
                onChange={e => setPw(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
                type={showPw ? 'text' : 'password'}
                placeholder="Set a password"
                className="flex-1 border-none bg-transparent py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                className="flex cursor-pointer border-none bg-transparent p-1 text-muted-foreground"
              >
                {showPw ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {isError && (
        <p className="mt-2.5 text-[11px] text-destructive">Failed to create share. Please try again.</p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2.5">
        <div className="mr-auto flex items-center gap-[7px] text-xs text-muted-foreground">
          <MiniAvatar member={currentMember} size={20} />
          <span>Sharing as {currentMember?.displayName ?? 'you'}</span>
        </div>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={submit} disabled={!valid || isPending}>
          <LinkIcon size={14} strokeWidth={2.2} /> {isPending ? 'Creating…' : 'Create link'}
        </Button>
      </div>
    </div>
  )
}

// ── The modal shell ──────────────────────────────────────────────────────────

export default function ShareModal({ teamId, timelineId, viewType, viewConfig, timelineName, onClose }: Props) {
  const { user } = useAuth()
  const { data: allShares = [], isLoading } = useListShares(teamId, timelineId)
  // Scoped to this exact view — a share is a frozen snapshot of one view's
  // config, so a Gantt link can't usefully stand in for a List or Kanban one.
  // Showing only same-type links keeps "active links" literal and leaves room
  // to tailor the modal per view type (e.g. Calendar/ICS in 13.4) without
  // having to reconcile it against unrelated shares.
  const shares = allShares.filter(s => s.viewType === viewType)
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
    ...(viewConfig.columns ? { columns: viewConfig.columns } : {}),
    ...(viewConfig.cardFields ? { cardFields: viewConfig.cardFields } : {}),
    ...(viewConfig.showHierarchy !== undefined ? { showHierarchy: viewConfig.showHierarchy } : {}),
    ...(viewConfig.collapsedColumns ? { collapsedColumns: viewConfig.collapsedColumns } : {}),
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(200_24%_11%/0.55)] p-6 backdrop-blur-[2px]"
    >
      <div
        className="flex max-h-[88vh] w-[min(580px,100%)] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-lg)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[18px]">
          <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)]', TILE_TEAL)}>
            <LinkIcon size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-bold leading-tight text-foreground">Share this view</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-secondary" />
              {timelineName ? `${timelineName} · ` : ''}anyone with a link can view
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border-none bg-muted text-muted-foreground"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Section bar */}
        <div className="flex shrink-0 items-center gap-2 px-5 pb-[11px] pt-[13px]">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Active links</span>
          <span className="min-w-[20px] rounded-[var(--radius-full)] bg-muted px-2 py-px text-center text-[11px] font-bold text-muted-foreground">{shares.length}</span>
          <div className="ml-auto">
            {!adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus size={14} strokeWidth={2.4} /> New share
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex min-h-[120px] flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
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
            <div className="flex flex-1 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border px-5 py-9 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-muted text-muted-foreground">
                <LinkIcon size={22} strokeWidth={1.8} />
              </div>
              <div className="text-sm font-semibold text-foreground">No share links yet</div>
              <div className="mt-1 max-w-[280px] text-[12.5px] text-muted-foreground">Create a link to let people outside your team view this timeline.</div>
              <Button size="sm" className="mt-4" onClick={() => setAdding(true)}>
                <Plus size={14} strokeWidth={2.4} /> Create share link
              </Button>
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
        <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-[13px]">
          <div className="flex items-center gap-[7px] text-xs text-muted-foreground">
            <Users size={14} strokeWidth={2} />
            Read-only links · anyone on your team can manage them
          </div>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
