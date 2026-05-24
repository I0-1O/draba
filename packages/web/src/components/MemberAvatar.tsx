/**
 * MemberAvatar — circular member badge using the identity system.
 *
 * Delegates to Badge internally so it inherits all identity rendering rules
 * (name initials, Lucide icons, color resolution). The external prop API is
 * unchanged so all existing call sites continue to work without modification.
 */

import Badge from './identity/Badge';
import type { Member } from '../types';
import { hexToColorId } from './identity/identity-constants';

interface Props {
  member: Member | undefined;
  size?: number;
  className?: string;
}

export default function MemberAvatar({ member, size = 28, className }: Props) {
  if (!member) {
    // Skeleton / undefined fallback: muted circle with no content.
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'var(--muted)',
          flexShrink: 0,
        }}
      />
    );
  }

  // Resolve colorId: prefer explicit colorId, else map legacy hex.
  const colorId = member.colorId ?? hexToColorId(member.color);

  return (
    <Badge
      identity={{ colorId, iconId: '__name_words__' }}
      name={member.name}
      shape="circle"
      size={size}
      className={className}
    />
  );
}
