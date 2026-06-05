/**
 * ShareModal — manage share links for the current view.
 *
 * Shows existing shares for the timeline (name, creator badge, copy, delete)
 * and lets the user create a new named share that snapshots the live toolbar state.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, Share2, X, Loader2, Trash2, Plus } from 'lucide-react'
import { useCreateShare, useListShares, useDeleteShare } from '@/hooks/useShares'
import { useTeamMembers } from '@/hooks/useTeamActivities'
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
  onClose: () => void
}

function MemberBadge({ member, index }: { member: TeamMemberWithUser | undefined; index: number }) {
  if (!member) return null
  const name = member.displayName || member.email || '?'
  const color = resolveColorHex(member.color) || MEMBER_COLORS[index % MEMBER_COLORS.length]
  return (
    <Badge
      identity={{ color, icon: member.icon ?? '__name_1__' }}
      name={name}
      size={18}
      shape="circle"
    />
  )
}

function ShareRow({
  share,
  memberByID,
  onDelete,
}: {
  share: Share
  memberByID: Map<string, TeamMemberWithUser>
  onDelete: (id: string) => void
}) {
  const url = `${window.location.origin}/s/${share.token}`
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const creator = share.createdBy ? memberByID.get(share.createdBy) : undefined
  const creatorIndex = creator ? [...memberByID.keys()].indexOf(share.createdBy) : 0

  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 10px', borderRadius: 6,
      background: 'var(--muted)', border: '1px solid var(--border)',
    }}>
      <MemberBadge member={creator} index={creatorIndex} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {share.name || 'Untitled link'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
          /s/{share.token.slice(0, 16)}…
        </div>
      </div>
      <button
        onClick={copy}
        title="Copy link"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--primary)' : 'var(--muted-foreground)', padding: '2px 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--destructive)' }}>Delete?</span>
          <button onClick={() => { onDelete(share.id); setConfirming(false) }}
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', fontWeight: 600, padding: '2px 4px' }}>
            Yes
          </button>
          <button onClick={() => setConfirming(false)}
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px 4px' }}>
            No
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} title="Delete share"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

export default function ShareModal({ teamId, timelineId, viewType, viewConfig, onClose }: Props) {
  const { data: existingShares = [], isLoading: sharesLoading } = useListShares(teamId, timelineId)
  const { data: members = [] } = useTeamMembers(teamId)
  const createShare = useCreateShare(teamId, timelineId)
  const deleteShare = useDeleteShare(teamId, timelineId)
  const [shareName, setShareName] = useState('')
  const [newShare, setNewShare] = useState<Share | null>(null)
  const [justCopied, setJustCopied] = useState(false)

  const memberByID = new Map(members.map(m => [m.id, m]))

  const configString = JSON.stringify({
    groupBy: viewConfig.groupBy,
    sortBy: viewConfig.sortBy,
    colorBy: viewConfig.colorBy,
    granularity: viewConfig.granularity,
    filter: viewConfig.filter ?? { logic: 'and', conditions: [] },
  })

  const handleCreate = () => {
    createShare.mutate(
      { name: shareName.trim() || null, viewType, viewConfig: configString },
      {
        onSuccess: (share) => {
          setNewShare(share)
          setShareName('')
          const url = `${window.location.origin}/s/${share.token}`
          void navigator.clipboard.writeText(url).then(() => {
            setJustCopied(true)
            setTimeout(() => setJustCopied(false), 2500)
          })
        },
      },
    )
  }

  // Merge newly-created share into the list before invalidation resolves.
  const allShares = newShare && !existingShares.find(s => s.id === newShare.id)
    ? [...existingShares, newShare]
    : existingShares

  const hasShares = allShares.length > 0

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, width: 440, padding: '20px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Share2 size={15} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Share</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Active link list */}
        {!sharesLoading && hasShares && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Active links
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allShares.map(s => (
                <ShareRow key={s.id} share={s} memberByID={memberByID} onDelete={(id) => deleteShare.mutate(id)} />
              ))}
            </div>
          </div>
        )}

        {hasShares && <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />}

        {!hasShares && (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 14, lineHeight: 1.5 }}>
            Creates a read-only link that shows exactly this view — same grouping, sorting, and filter.
            Anyone with the link can view it without logging in.
          </p>
        )}

        {/* Name input */}
        <input
          type="text"
          placeholder="Link name (optional)"
          value={shareName}
          onChange={e => setShareName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          style={{
            width: '100%', padding: '7px 10px', marginBottom: 10,
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--background)', color: 'var(--foreground)',
            fontSize: 13, boxSizing: 'border-box', outline: 'none',
            fontFamily: 'var(--font-sans)',
          }}
        />

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={createShare.isPending}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '8px 0',
            background: hasShares ? 'var(--muted)' : 'var(--primary)',
            color: hasShares ? 'var(--foreground)' : 'var(--primary-foreground)',
            border: hasShares ? '1px solid var(--border)' : 'none',
            borderRadius: 6, fontSize: 13, fontWeight: 600,
            cursor: createShare.isPending ? 'not-allowed' : 'pointer',
            opacity: createShare.isPending ? 0.7 : 1,
          }}
        >
          {createShare.isPending
            ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
            : justCopied
              ? <><Check size={14} /> Link copied to clipboard</>
              : <><Plus size={14} /> Create link</>
          }
        </button>

        {createShare.isError && (
          <p style={{ fontSize: 11, color: 'var(--destructive)', marginTop: 8 }}>
            Failed to create share. Please try again.
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
