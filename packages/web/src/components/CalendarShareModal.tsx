/**
 * CalendarShareModal — manage the ICS calendar feeds for a timeline.
 *
 * Deliberately a different surface from ShareModal (Phase 13.4): a Calendar
 * share is not a frozen view snapshot but a live subscribable ICS feed. The
 * modal is a flat list of every feed the timeline can publish — the whole
 * timeline first, then one row per team member — each with an on/off toggle.
 * Toggling a row on creates that feed and reveals its URL (copy, one-click
 * subscribe links, regenerate); toggling off deletes it, killing the URL
 * immediately.
 *
 * All feeds are public read-only. There is no password option: calendar
 * clients cannot unlock a subscription URL interactively, so the unguessable
 * token is the secret and revocation is regenerate-or-toggle-off.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays, Link2, Copy, Check, RefreshCw, X, Users,
} from 'lucide-react'
import { useListShares, useCreateShare, useDeleteShare, useRegenerateShare } from '@/hooks/useShares'
import { useTeamMembers } from '@/hooks/useTeamActivities'
import { Badge } from '@/components/identity/Badge'
import { resolveColorHex } from '@/components/identity/identity-constants'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MEMBER_COLORS } from '@/types'
import type { components } from '@draba/shared'

type Share = components['schemas']['Share']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

interface Props {
  teamId: string
  timelineId: string
  /** Display name of the timeline, shown in the header subtitle and feed names. */
  timelineName?: string
  onClose: () => void
}

const TILE_TEAL = 'bg-[hsl(188_59%_38%/0.12)] text-primary'

/** Builds the absolute https feed URL for a share token. */
function feedURL(token: string): string {
  return `${window.location.origin}/shares/${token}.ics`
}

/** The webcal:// variant most calendar apps treat as "subscribe". */
function webcalURL(token: string): string {
  return feedURL(token).replace(/^https?:\/\//, 'webcal://')
}

// ── One feed row: label + toggle, expanding to the link when on ───────────────

function FeedRow({
  label,
  member,
  share,
  busy,
  onToggle,
  onRegenerate,
}: {
  label: string
  /** Set for member rows — renders the identity badge next to the label. */
  member?: TeamMemberWithUser
  /** The existing ICS share for this row, when the feed is on. */
  share?: Share
  busy: boolean
  onToggle: () => void
  onRegenerate: (shareId: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const on = Boolean(share)
  const url = share ? feedURL(share.token) : null
  const webcal = share ? webcalURL(share.token) : null

  const copy = () => {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {member ? (
          <Badge
            identity={{ color: resolveColorHex(member.color) || MEMBER_COLORS[0], icon: member.icon ?? '__name_1__' }}
            name={member.displayName || 'Team member'}
            size={26}
            shape="circle"
          />
        ) : (
          <div className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[var(--radius-md)]', TILE_TEAL)}>
            <CalendarDays size={14} strokeWidth={2.2} />
          </div>
        )}
        <div className="flex-1 text-[13px] font-semibold text-foreground">{label}</div>
        <button
          onClick={onToggle}
          role="switch"
          aria-checked={on}
          aria-label={`${label} feed`}
          disabled={busy}
          className={cn(
            'relative h-[22px] w-10 shrink-0 cursor-pointer rounded-[var(--radius-full)] border-none p-0 transition-colors',
            on ? 'bg-primary' : 'bg-border',
          )}
        >
          <span className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left] duration-150',
            on ? 'left-5' : 'left-[2px]',
          )} />
        </button>
      </div>

      {share && url && webcal && (
        <div className="flex flex-col gap-2 border-t border-border bg-muted/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] bg-muted px-[11px] py-[7px] font-mono text-[12px] text-foreground">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="text-muted-foreground">Add to:</span>
            <a
              href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Google
            </a>
            <a href={webcal} className="font-semibold text-primary hover:underline">
              Apple
            </a>
            <a
              href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcal)}&name=${encodeURIComponent(share.name ?? label)}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              Outlook
            </a>
            <button
              onClick={() => onRegenerate(share.id)}
              disabled={busy}
              title="Replace the link — the old URL stops working immediately"
              className="ml-auto flex cursor-pointer items-center gap-[5px] border-none bg-transparent p-0 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw size={12} strokeWidth={2} />
              Regenerate link
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── The modal shell ────────────────────────────────────────────────────────────

export default function CalendarShareModal({ teamId, timelineId, timelineName, onClose }: Props) {
  const { data: allShares = [], isLoading } = useListShares(teamId, timelineId)
  const { data: members = [] } = useTeamMembers(teamId)
  const createShare = useCreateShare(teamId, timelineId)
  const deleteShare = useDeleteShare(teamId, timelineId)
  const regenerateShare = useRegenerateShare(teamId, timelineId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const icsShares = allShares.filter(s => s.kind === 'ics')
  const timelineShare = icsShares.find(s => s.scope === 'timeline')
  const memberShare = (memberId: string) =>
    icsShares.find(s => s.scope === 'member' && s.memberId === memberId)

  const busy = isLoading || createShare.isPending || deleteShare.isPending || regenerateShare.isPending

  const toggleTimeline = () => {
    if (busy) return
    if (timelineShare) {
      deleteShare.mutate(timelineShare.id)
    } else {
      createShare.mutate({ kind: 'ics', scope: 'timeline', name: `${timelineName ?? 'Timeline'} calendar feed` })
    }
  }

  const toggleMember = (m: TeamMemberWithUser) => {
    if (busy) return
    const existing = memberShare(m.id)
    if (existing) {
      deleteShare.mutate(existing.id)
    } else {
      createShare.mutate({
        kind: 'ics',
        scope: 'member',
        memberId: m.id,
        name: `${m.displayName || 'Member'} calendar feed`,
      })
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(200_24%_11%/0.55)] p-6 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-[min(560px,100%)] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[18px]">
          <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)]', TILE_TEAL)}>
            <CalendarDays size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-bold leading-tight text-foreground">Share calendar</h2>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {timelineName ? `${timelineName} · ` : ''}live read-only feeds — subscribe from Google, Apple, or Outlook
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

        {/* Body — one row per publishable feed */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-4">
          <FeedRow
            label="Whole timeline"
            share={timelineShare}
            busy={busy}
            onToggle={toggleTimeline}
            onRegenerate={id => regenerateShare.mutate(id)}
          />

          {members.length > 0 && (
            <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Per member</div>
          )}
          {members.map(m => (
            <FeedRow
              key={m.id}
              label={m.displayName || 'Team member'}
              member={m}
              share={memberShare(m.id)}
              busy={busy}
              onToggle={() => toggleMember(m)}
              onRegenerate={id => regenerateShare.mutate(id)}
            />
          ))}

          {(createShare.isError || deleteShare.isError || regenerateShare.isError) && (
            <p className="text-[11px] text-destructive">Something went wrong. Please try again.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-[13px]">
          <div className="flex items-center gap-[7px] text-xs text-muted-foreground">
            <Users size={14} strokeWidth={2} />
            Public read-only · the link itself is the secret
          </div>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
