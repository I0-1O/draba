/**
 * IdentityPicker — popover content panel with three sections.
 *
 * Section 1: Color grid — 16 colors in an 8×2 grid.
 * Section 2: Name options — None / 1 letter / 2 letters / 1+1 words (mini badge previews).
 * Section 3: Icon grid — 64 Lucide icons in an 8×8 grid.
 *
 * All changes fire onChange immediately — no save/cancel.
 */

import * as LucideIcons from 'lucide-react';
import { Check } from 'lucide-react';
import Badge from './Badge';
import type { Identity } from './identity-constants';
import {
  IDENTITY_COLORS,
  IDENTITY_ICONS,
  resolveColorHex,
  iconIdToPascal,
} from './identity-constants';

interface Props {
  identity: Identity;
  name: string;
  shape?: 'square' | 'circle';
  onChange: (next: Identity) => void;
}

const NAME_OPTIONS = [
  { iconId: '__none__',       label: 'None' },
  { iconId: '__name_1__',     label: '1 letter' },
  { iconId: '__name_2__',     label: '2 letters' },
  { iconId: '__name_words__', label: '1+1 words' },
] as const;

const SEC_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
};

export default function IdentityPicker({ identity, name, shape = 'square', onChange }: Props) {
  const isNameOption = NAME_OPTIONS.some(o => o.iconId === identity.iconId);
  const isIconOption = !isNameOption && identity.iconId !== '__none__';

  function setColor(colorId: string) {
    onChange({ ...identity, colorId });
  }

  function setIconId(iconId: string) {
    onChange({ ...identity, iconId });
  }

  return (
    <div
      style={{
        padding: 14,
        width: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        background: 'var(--popover)',
        color: 'var(--popover-foreground)',
      }}
    >
      {/* ── Section 1: Color grid ── */}
      <div>
        <div style={SEC_LABEL}>Color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
          {IDENTITY_COLORS.map(c => {
            const selected = identity.colorId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                title={c.name}
                onClick={() => setColor(c.id)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: c.hex,
                  border: selected ? `2px solid var(--foreground)` : '2px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.1s',
                  position: 'relative',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                {selected && <Check size={12} color="white" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: Name options ── */}
      <div>
        <div style={SEC_LABEL}>Label</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {NAME_OPTIONS.map(opt => {
            const selected = identity.iconId === opt.iconId;
            const accentHex = resolveColorHex(identity.colorId);
            return (
              <button
                key={opt.iconId}
                type="button"
                title={opt.label}
                onClick={() => setIconId(opt.iconId)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 4px',
                  borderRadius: 6,
                  border: selected ? `1.5px solid ${accentHex}` : '1.5px solid var(--border)',
                  background: selected ? `${accentHex}18` : 'var(--background)',
                  cursor: 'pointer',
                  transition: 'border-color 0.1s, background 0.1s',
                }}
              >
                <Badge
                  identity={{ colorId: identity.colorId, iconId: opt.iconId }}
                  name={name}
                  shape={shape}
                  size={20}
                />
                <span style={{ fontSize: 9, color: 'var(--muted-foreground)', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Icon grid ── */}
      <div>
        <div style={SEC_LABEL}>Icon</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
          {IDENTITY_ICONS.map((iconId, i) => {
            const pascalName = iconIdToPascal(iconId) as keyof typeof LucideIcons;
            const IconComponent = LucideIcons[pascalName] as React.ComponentType<{ size: number; strokeWidth: number }> | undefined;
            if (!IconComponent) return null;

            const selected = identity.iconId === iconId && isIconOption;
            const accentHex = resolveColorHex(identity.colorId);
            return (
              <button
                key={`${iconId}-${i}`}
                type="button"
                title={iconId}
                onClick={() => setIconId(iconId)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  background: selected ? accentHex : 'transparent',
                  color: selected ? 'white' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  if (!selected) {
                    e.currentTarget.style.background = 'var(--muted)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }
                }}
                onMouseLeave={e => {
                  if (!selected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--muted-foreground)';
                  }
                }}
              >
                <IconComponent size={13} strokeWidth={1.8} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
