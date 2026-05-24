/**
 * Badge — read-only identity display component.
 *
 * Renders an entity's color + icon combination. The colorId (or legacy hex)
 * becomes the background; iconId controls the content:
 *   - Lucide icon name (kebab-case) → the corresponding icon
 *   - '__name_1__' / '__name_2__' / '__name_words__' → text initials from name
 *   - '__none__' or absent → color-only, no content
 */

import * as LucideIcons from 'lucide-react';
import type { Identity } from './identity-constants';
import { resolveColorHex, iconIdToPascal, getNameText } from './identity-constants';

interface Props {
  identity: Identity;
  /** Entity name — used to derive initials for name-based icon IDs. */
  name: string;
  shape?: 'square' | 'circle';
  /** Size in px. Typically 20–40. */
  size?: number;
  className?: string;
}

export default function Badge({ identity, name, shape = 'square', size = 24, className }: Props) {
  const bg = resolveColorHex(identity.colorId);
  const radius = shape === 'circle' ? '50%' : `${Math.round(size * 0.26)}px`;
  const { iconId } = identity;

  let content: React.ReactNode = null;

  if (iconId && iconId !== '__none__') {
    const nameText = getNameText(iconId, name);
    if (nameText) {
      // Name-based: show initials as white bold text.
      const chars = nameText.length;
      // Scale font down when there are 3 characters.
      const fontSize = chars >= 3 ? Math.round(size * 0.29) : Math.round(size * 0.38);
      content = (
        <span style={{ fontSize, fontWeight: 700, lineHeight: 1, color: 'white', userSelect: 'none', fontFamily: 'var(--font-sans)' }}>
          {nameText}
        </span>
      );
    } else {
      // Lucide icon: convert kebab-case id to PascalCase component name.
      const pascalName = iconIdToPascal(iconId) as keyof typeof LucideIcons;
      const IconComponent = LucideIcons[pascalName] as React.ComponentType<{ size: number; color: string; strokeWidth: number }> | undefined;
      if (IconComponent) {
        content = <IconComponent size={Math.round(size * 0.54)} color="white" strokeWidth={2} />;
      }
    }
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {content}
    </div>
  );
}
