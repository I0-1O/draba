/**
 * Top toolbar above the active view. Left side: global app navigation
 * (view switcher) and global object actions (Share). Right side: global
 * cross-view actions, currently just the Filter dropdown, plus whatever
 * the parent injects into `rightSlot` (typically the profile menu).
 *
 * View-specific controls (date nav, zoom) intentionally live elsewhere —
 * a context-sensitive sub-toolbar will host them in a later phase.
 */

import { useState } from 'react';
import { CalendarDays, GanttChart, Columns3, List, Search, X } from 'lucide-react';
import FilterDropdown from '@/components/filters/FilterDropdown';

export type ViewMode = 'calendar' | 'gantt' | 'kanban' | 'list';

interface Props {
  view: ViewMode;
  teamId?: string;
  onViewChange: (view: ViewMode) => void;
  onOpenFilterEditor: () => void;
  rightSlot?: React.ReactNode;
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'list',     icon: <List size={13} strokeWidth={1.8} />,        label: 'List' },
  { id: 'calendar', icon: <CalendarDays size={13} strokeWidth={1.8} />, label: 'Calendar' },
  { id: 'gantt',    icon: <GanttChart size={13} strokeWidth={1.8} />,  label: 'Gantt' },
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

function SearchInput() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        height: 28,
        padding: '0 8px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--card)',
        width: focused ? 200 : 140,
        transition: 'width 0.15s ease',
        flexShrink: 0,
      }}
    >
      <Search size={13} strokeWidth={1.8} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--foreground)',
          fontSize: 12,
          fontFamily: 'var(--font-sans)',
          minWidth: 0,
        }}
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'none',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            flexShrink: 0,
          }}
        >
          <X size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

export default function TopBar({
  view,
  teamId,
  onViewChange,
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

      <div style={{ flex: 1 }} />

      {/* Search stub — highlight wiring in Phase 8.5 */}
      <SearchInput />

      {/* Filter dropdown */}
      <FilterDropdown teamId={teamId} onOpenEditor={onOpenFilterEditor} />

      {/* Profile avatar — injected by parent */}
      {rightSlot}
    </div>
  );
}
