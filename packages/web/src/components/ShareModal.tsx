/**
 * ShareModal — create a share link for the current Gantt view.
 *
 * Captures the live toolbar state (groupBy, sortBy, colorBy, granularity,
 * and the resolved active filter definition) into a view_config snapshot,
 * calls POST /timelines/{id}/shares, and copies the resulting /s/:token URL
 * to the clipboard.
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Check, Share2, X, Loader2 } from 'lucide-react'
import { useCreateShare } from '@/hooks/useShares'
import type { FilterDefinition } from '@/lib/filterTypes'

export interface ShareViewConfig {
  groupBy: string
  sortBy: string
  colorBy: string
  granularity: string
  /** The resolved FilterDefinition at the moment "Share this view" was clicked. */
  filter: FilterDefinition | null
}

interface Props {
  teamId: string
  timelineId: string
  viewType: 'gantt' | 'list' | 'calendar' | 'kanban'
  viewConfig: ShareViewConfig
  onClose: () => void
}

export default function ShareModal({ teamId, timelineId, viewType, viewConfig, onClose }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const createShare = useCreateShare(teamId, timelineId)

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
          setShareUrl(url)
          copyToClipboard(url)
        },
      },
    )
  }

  const copyToClipboard = (url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 420,
          padding: '20px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Share2 size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>
            Share this view
          </span>
          <button
            onClick={onClose}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2 }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16, lineHeight: 1.5 }}>
          Creates a read-only link showing exactly this view — same grouping, sorting, and filter.
          Anyone with the link can view it without logging in.
        </p>

        {shareUrl ? (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              <input
                readOnly
                value={shareUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                style={{
                  flex: 1, fontSize: 11, padding: '6px 8px',
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--muted)', color: 'var(--foreground)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              <button
                onClick={() => copyToClipboard(shareUrl)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 6,
                  background: copied ? 'var(--primary)' : 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: copied ? 'var(--primary-foreground)' : 'var(--foreground)',
                  fontSize: 12, cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              Link copied to clipboard. The view is live — changes to activities will appear within ~60 seconds.
            </p>
          </>
        ) : (
          <button
            onClick={handleCreate}
            disabled={createShare.isPending}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: '8px 0',
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: createShare.isPending ? 'not-allowed' : 'pointer',
              opacity: createShare.isPending ? 0.7 : 1,
            }}
          >
            {createShare.isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            {createShare.isPending ? 'Creating link…' : 'Create share link'}
          </button>
        )}

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
