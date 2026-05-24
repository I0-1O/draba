/**
 * IdentityTrigger — a clickable identity badge with a chevron pip.
 *
 * Fixed 28×28 badge with a small chevron indicator at the bottom-right.
 * Shows a colored ring on hover and when the picker is open.
 */

import { ChevronDown } from 'lucide-react';
import Badge from './Badge';
import type { Identity } from './identity-constants';
import { resolveColorHex } from './identity-constants';

interface Props {
  identity: Identity;
  name: string;
  shape?: 'square' | 'circle';
  open?: boolean;
  onClick?: () => void;
}

export default function IdentityTrigger({ identity, name, shape = 'square', open = false, onClick }: Props) {
  const accentColor = resolveColorHex(identity.colorId);

  return (
    <button
      type="button"
      onClick={onClick}
      title="Change color and icon"
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: shape === 'circle' ? '50%' : 6,
        outline: open ? `2px solid ${accentColor}` : 'none',
        outlineOffset: 2,
        transition: 'outline 0.1s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (!open) e.currentTarget.style.outline = `2px solid ${accentColor}`; e.currentTarget.style.outlineOffset = '2px'; }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.outline = 'none'; }}
    >
      <Badge identity={identity} name={name} shape={shape} size={28} />
      {/* Chevron pip — bottom-right corner */}
      <div
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 13,
          height: 13,
          borderRadius: '50%',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <ChevronDown size={8} strokeWidth={2.5} color="var(--muted-foreground)" />
      </div>
    </button>
  );
}
