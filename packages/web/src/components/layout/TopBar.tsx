/**
 * Top toolbar above the active view. Left side: global app navigation
 * (view switcher) and global object actions (Share). Right side: global
 * cross-view actions, currently just the Filter dropdown, plus whatever
 * the parent injects into `rightSlot` (typically the profile menu).
 *
 * View-specific controls (date nav, zoom) intentionally live elsewhere —
 * a context-sensitive sub-toolbar will host them in a later phase.
 */

import { CalendarDays, GanttChart, Columns3, List, Share2 } from 'lucide-react';
import FilterDropdown from '@/components/filters/FilterDropdown';

export type ViewMode = 'calendar' | 'timeline' | 'kanban' | 'list';

interface Props {
  view: ViewMode;
  teamId?: string;
  onViewChange: (view: ViewMode) => void;
  onShare?: () => void;
  onOpenFilterEditor: () => void;
  rightSlot?: React.ReactNode;
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'list',     icon: <List size={13} strokeWidth={1.8} />,        label: 'List' },
  { id: 'calendar', icon: <CalendarDays size={13} strokeWidth={1.8} />, label: 'Calendar' },
  { id: 'timeline', icon: <GanttChart size={13} strokeWidth={1.8} />,  label: 'Timeline' },
  { id: 'kanban',   icon: <Columns3 size={13} strokeWidth={1.8} />,    label: 'Kanban' },
];

const BTN_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  border: 'none',
};

function IconBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        ...BTN_BASE,
        width: 28,
        height: 28,
        flexShrink: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--card)',
        color: 'var(--muted-foreground)',
      }}
    >
      {icon}
    </button>
  );
}

export default function TopBar({
  view,
  teamId,
  onViewChange,
  onShare,
  onOpenFilterEditor,
  rightSlot,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 12px',
        height: 'var(--topbar-h)',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Left: view switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        background: 'var(--muted)',
        borderRadius: 'var(--radius-md)',
        padding: 2,
        flexShrink: 0,
      }}>
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            style={{
              ...BTN_BASE,
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 5,
              background: view === v.id ? 'var(--card)' : 'transparent',
              color: view === v.id ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: view === v.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Left: share */}
      <IconBtn icon={<Share2 size={14} strokeWidth={2} />} onClick={onShare} title="Share" />

      <div style={{ flex: 1 }} />

      {/* Right: filter dropdown */}
      <FilterDropdown teamId={teamId} onOpenEditor={onOpenFilterEditor} />

      {/* Profile avatar — injected by parent */}
      {rightSlot}
    </div>
  );
}
