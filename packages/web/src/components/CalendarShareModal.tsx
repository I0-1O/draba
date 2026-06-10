/**
 * CalendarShareModal — manage the ICS calendar feeds for a timeline.
 *
 * Deliberately a different surface from ShareModal (Phase 13.4): a Calendar
 * share is not a frozen view snapshot but a live subscribable ICS feed, so
 * instead of an active-links list this modal is a feed configurator — a scope
 * selector (whole timeline vs. one member), a public-access On/Off toggle, the
 * feed URL with one-click add-to-calendar links, and Regenerate.
 *
 * There is no password option: calendar clients cannot unlock a subscription
 * URL interactively, so the unguessable token is the secret and revocation is
 * regenerate-or-toggle-off.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays, Link2, Copy, Check, RefreshCw, X, Rss, Users,
} from 'lucide-react'
import { useListShares, useCreateShare, useDeleteShare, useRegenerateShare } from '@/hooks/useShares'
import { useTeamMembers } from '@/hooks/useTeamActivities'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { components } from '@draba/shared'

type Share = components['schemas']['Share']

type FeedScope = 'timeline' | 'member'

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

export default function CalendarShareModal({ teamId, timelineId, timelineName, onClose }: Props) {
  const { data: allShares = [], isLoading } = useListShares(teamId, timelineId)
  const { data: members = [] } = useTeamMembers(teamId)
  const createShare = useCreateShare(teamId, timelineId)
  const deleteShare = useDeleteShare(teamId, timelineId)
  const regenerateShare = useRegenerateShare(teamId, timelineId)

  const [scope, setScope] = useState<FeedScope>('timeline')
  const [memberId, setMemberId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Default the member selector to the first team member once loaded.
  useEffect(() => {
    if (!memberId && members.length > 0) setMemberId(members[0].id)
  }, [memberId, members])

  const icsShares = allShares.filter((s): s is Share => s.kind === 'ics')
  const activeShare = scope === 'timeline'
    ? icsShares.find(s => s.scope === 'timeline')
    : icsShares.find(s => s.scope === 'member' && s.memberId === memberId)

  const selectedMember = members.find(m => m.id === memberId)
  const mutating = createShare.isPending || deleteShare.isPending || regenerateShare.isPending

  const handleToggle = () => {
    if (mutating || isLoading) return
    if (activeShare) {
      deleteShare.mutate(activeShare.id)
      return
    }
    if (scope === 'member' && !memberId) return
    const name = scope === 'timeline'
      ? `${timelineName ?? 'Timeline'} calendar feed`
      : `${selectedMember?.displayName ?? 'Member'} calendar feed`
    createShare.mutate({
      kind: 'ics',
      scope,
      ...(scope === 'member' ? { memberId } : {}),
      name,
    })
  }

  const copy = () => {
    if (!activeShare) return
    void navigator.clipboard.writeText(feedURL(activeShare.token)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  const scopeBtn = (value: FeedScope, label: string) => (
    <button
      onClick={() => setScope(value)}
      className={cn(
        'flex-1 cursor-pointer rounded-[var(--radius-md)] border px-3 py-2 text-[13px] font-semibold transition-colors',
        scope === value
          ? 'border-primary bg-[hsl(188_59%_38%/0.08)] text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )

  const url = activeShare ? feedURL(activeShare.token) : null
  const webcal = activeShare ? webcalURL(activeShare.token) : null

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(200_24%_11%/0.55)] p-6 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-[min(520px,100%)] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[18px]">
          <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)]', TILE_TEAL)}>
            <CalendarDays size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-bold leading-tight text-foreground">Share calendar</h2>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {timelineName ? `${timelineName} · ` : ''}subscribe from Google, Apple, or Outlook
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

        {/* Body */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {/* Scope selector */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Feed scope</div>
            <div className="flex gap-2">
              {scopeBtn('timeline', 'Whole timeline')}
              {scopeBtn('member', 'One member')}
            </div>
            {scope === 'member' && (
              <select
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                aria-label="Member"
                className="mt-2 h-9 w-full cursor-pointer rounded-[var(--radius-md)] border border-border bg-card px-2.5 text-[13px] text-foreground"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.displayName || 'Team member'}</option>
                ))}
              </select>
            )}
          </div>

          {/* Public access toggle */}
          <div className="overflow-hidden rounded-[var(--radius-md)] border border-border">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-muted text-muted-foreground">
                <Rss size={14} strokeWidth={2} />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-foreground">Public calendar feed</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {activeShare
                    ? 'Live feed is on — turning it off immediately kills the link'
                    : 'Publish a live, read-only feed anyone with the link can subscribe to'}
                </div>
              </div>
              <button
                onClick={handleToggle}
                role="switch"
                aria-checked={Boolean(activeShare)}
                aria-label="Public calendar feed"
                disabled={mutating || isLoading}
                className={cn(
                  'relative h-[22px] w-10 shrink-0 cursor-pointer rounded-[var(--radius-full)] border-none p-0 transition-colors',
                  activeShare ? 'bg-primary' : 'bg-border',
                )}
              >
                <span className={cn(
                  'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-[left] duration-150',
                  activeShare ? 'left-5' : 'left-[2px]',
                )} />
              </button>
            </div>

            {activeShare && url && webcal && (
              <div className="flex flex-col gap-2.5 border-t border-border px-3 py-3">
                {/* Feed URL + copy */}
                <div className="flex items-center gap-2">
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

                {/* One-click subscribe links */}
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-[5px] rounded-[var(--radius-md)] border border-border bg-card px-3 py-[6px] text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Add to Google
                  </a>
                  <a
                    href={webcal}
                    className="flex items-center gap-[5px] rounded-[var(--radius-md)] border border-border bg-card px-3 py-[6px] text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Add to Apple
                  </a>
                  <a
                    href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(webcal)}&name=${encodeURIComponent(activeShare.name ?? timelineName ?? 'draba')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-[5px] rounded-[var(--radius-md)] border border-border bg-card px-3 py-[6px] text-[12.5px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Add to Outlook
                  </a>
                  <button
                    onClick={() => regenerateShare.mutate(activeShare.id)}
                    disabled={mutating}
                    title="Replace the link — the old URL stops working immediately"
                    className="ml-auto flex cursor-pointer items-center gap-[5px] rounded-[var(--radius-md)] border border-border bg-card px-3 py-[6px] text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RefreshCw size={13} strokeWidth={2} className={regenerateShare.isPending ? 'animate-spin' : undefined} />
                    Regenerate link
                  </button>
                </div>
              </div>
            )}
          </div>

          {(createShare.isError || deleteShare.isError || regenerateShare.isError) && (
            <p className="text-[11px] text-destructive">Something went wrong. Please try again.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-[13px]">
          <div className="flex items-center gap-[7px] text-xs text-muted-foreground">
            <Users size={14} strokeWidth={2} />
            Live data · no password — the link itself is the secret
          </div>
          <Button variant="outline" className="ml-auto" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
