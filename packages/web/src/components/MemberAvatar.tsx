import type { Member } from '../types';

interface Props {
  member: Member | undefined;
  size?: number;
  className?: string;
}

export default function MemberAvatar({ member, size = 28, className }: Props) {
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
