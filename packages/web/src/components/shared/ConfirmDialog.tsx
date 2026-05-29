/**
 * ConfirmDialog — shared confirmation panel for destructive / significant actions.
 *
 * Renders inline inside a modal panel (not a portal), replacing the modal's
 * content area. The parent is responsible for showing/hiding this component.
 */

const cancelBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  color: 'var(--muted-foreground)',
  fontSize: 13,
  padding: '7px 18px',
  borderRadius: 7,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

export interface ConfirmDialogProps {
  /** Color variant: red = destructive delete, amber = archive, indigo = promote, teal = restore */
  variant: 'red' | 'amber' | 'indigo' | 'teal'
  icon: React.ReactNode
  title: string
  body: string
  confirmLabel: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

const VARIANT_COLORS: Record<ConfirmDialogProps['variant'], string> = {
  red:    '#EF4444',
  amber:  '#F59E0B',
  indigo: '#6366F1',
  teal:   '#1A97A2',
}

export function ConfirmDialog({ variant, icon, title, body, confirmLabel, busy, onCancel, onConfirm }: ConfirmDialogProps) {
  const c = VARIANT_COLORS[variant]
  return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${c}20`, border: `1.5px solid ${c}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.6, maxWidth: 340 }}>{body}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} disabled={busy} style={cancelBtnStyle}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            background: `${c}22`, border: `1px solid ${c}66`, color: c,
            fontWeight: 600, fontSize: 13, padding: '7px 18px',
            borderRadius: 7, cursor: 'pointer',
            opacity: busy ? 0.6 : 1,
            fontFamily: 'var(--font-sans)',
          }}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}

// Re-export color map so callers can reference variant colors for icons.
export { VARIANT_COLORS }
