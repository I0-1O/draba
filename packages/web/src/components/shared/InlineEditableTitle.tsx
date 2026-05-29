/**
 * InlineEditableTitle — always-visible input for modal header names.
 *
 * Looks like plain text at rest; shows a subtle bottom border on hover/focus
 * to signal editability. Standardizes the three different name-editing patterns
 * across TeamModal, MemberModal, and TimelineModal.
 */

import { useState, forwardRef } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  readOnly?: boolean
  autoFocus?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

const InlineEditableTitle = forwardRef<HTMLInputElement, Props>(
  function InlineEditableTitle({ value, onChange, placeholder, readOnly, autoFocus, onKeyDown }, ref) {
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)

    return (
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--foreground)',
          background: 'transparent',
          outline: 'none',
          padding: '1px 0',
          width: '100%',
          fontFamily: 'var(--font-sans)',
          border: 'none',
          borderBottom: (hovered || focused) ? '1px solid var(--border)' : '1px solid transparent',
          borderRadius: 0,
          transition: 'border-color 0.12s',
          cursor: readOnly ? 'default' : 'text',
        }}
      />
    )
  },
)

export default InlineEditableTitle
