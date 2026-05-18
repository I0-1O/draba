/**
 * Generic right-edge slide-in panel. Currently used for the filter editor;
 * the body is provided by the caller. Visibility is fully controlled — when
 * `open` is false the panel collapses to zero width with a CSS transition.
 */

import { X } from 'lucide-react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

const WIDTH = 320

export default function RightSidebar({ open, title, onClose, children }: Props) {
  return (
    <div
      style={{
        width: WIDTH,
        minWidth: WIDTH,
        flexShrink: 0,
        background: 'var(--card)',
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 'var(--topbar-h)',
            padding: '0 12px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
          <button
            onClick={onClose}
            title="Close"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 4,
              background: 'none',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>{children}</div>
      </div>
    </div>
  )
}
