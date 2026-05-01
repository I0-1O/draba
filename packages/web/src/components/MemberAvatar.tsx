import type { Member } from '../types';

interface Props {
  member: Member | undefined;
  size?: number;
  className?: string;
}

/**
 * Circular avatar showing a member's initials over their assigned color.
 * Falls back to a muted background and empty label when `member` is undefined,
 * so callers can render skeletons without conditionals.
 */
export default function MemberAvatar({ member, size = 28, className }: Props) {
  // Tuned by eye: 38% of diameter keeps two-letter initials inside the circle
  // at every size we use (22–32px) without per-size overrides.
  const fontSize = Math.round(size * 0.38);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: member?.color ?? 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        color: 'white',
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
      }}
    >
      {member?.initials}
    </div>
  );
}
