/**
 * ShareModal — manage share links for the current Gantt view.
 *
 * Shows existing shares for the timeline (with copy + delete per link) and
 * lets the user create a new share that snapshots the live toolbar state.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, Share2, X, Loader2, Trash2, Plus } from 'lucide-react'
import { useCreateShare, useListShares, useDeleteShare } from '@/hooks/useShares'
import type { FilterDefinition } from '@/lib/filterTypes'
import type { components } from '@draba/shared'

type Share = components['schemas']['Share']

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

function ShareRow({
  share,
  onDelete,
}: {
  share: Share
  onDelete: (id: string) => void
}) {
  const url = `${window.location.origin}/s/${share.token}`
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const copy = () => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 8px', borderRadius: 6,
      background: 'var(--muted)', border: '1px solid var(--border)',
    }}>
      <span style={{ flex: 1, fontSize: 11, color: 'var(--foreground)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        /s/{share.token.slice(0, 12)}…
      </span>
      <button
        onClick={copy}
        title="Copy link"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--primary)' : 'var(--muted-foreground)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--destructive)' }}>Delete?</span>
          <button
            onClick={() => { onDelete(share.id); setConfirming(false) }}
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', fontWeight: 600, padding: '2px 4px' }}
          >
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px 4px' }}
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          title="Delete share"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

export default function ShareModal({ teamId, timelineId, viewType, viewConfig, onClose }: Props) {
  const { data: existingShares = [], isLoading: sharesLoading } = useListShares(teamId, timelineId)
  const createShare = useCreateShare(teamId, timelineId)
  const deleteShare = useDeleteShare(teamId, timelineId)
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const configString = JSON.stringify({
    groupBy: viewConfig.groupBy,
    sortBy: viewConfig.sortBy,
    colorBy: viewConfig.colorBy,
    granularity: viewConfig.granularity,
    filter: viewConfig.filter ?? { logic: 'and', conditions: [] },
  })

  const handleCreate = () => {
    createShare.mutate(
      { viewType, viewConfig: configString },
      {
        onSuccess: (share) => {
          const url = `${window.location.origin}/s/${share.token}`
          setNewShareUrl(url)
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        },
      },
    )
  }

  const copyUrl = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const hasShares = existingShares.length > 0 || newShareUrl !== null

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, width: 440, padding: '20px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', position: 'relative' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Share2 size={15} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>Share this view</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Existing shares */}
        {!sharesLoading && hasShares && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Active links
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {existingShares.map(s => (
                <ShareRow
                  key={s.id}
                  share={s}
                  onDelete={(id) => deleteShare.mutate(id)}
                />
              ))}
              {newShareUrl && !existingShares.find(s => `${window.location.origin}/s/${s.token}` === newShareUrl) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                  <input
                    readOnly
                    value={newShareUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    style={{ flex: 1, fontSize: 11, border: 'none', background: 'transparent', color: 'var(--foreground)', fontFamily: 'var(--font-mono)', outline: 'none' }}
                  />
                  <button
                    onClick={() => copyUrl(newShareUrl)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--primary)' : 'var(--muted-foreground)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider when there are existing shares */}
        {hasShares && <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />}

        {/* Description */}
        {!hasShares && (
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, lineHeight: 1.5 }}>
            Creates a read-only link showing exactly this view — same grouping, sorting, and filter.
            Anyone with the link can view it without logging in.
          </p>
        )}

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
            : <><Plus size={14} /> New share link</>
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
