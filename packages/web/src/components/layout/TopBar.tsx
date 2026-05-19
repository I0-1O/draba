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
import { cn } from '@/lib/utils';

export type ViewMode = 'calendar' | 'gantt' | 'kanban' | 'list';

interface Props {
  view: ViewMode;
  teamId?: string;
  timelineName?: string;
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

function SearchInput() {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  return (
    <div className={cn(
      'flex items-center gap-1 h-7 px-2',
      'border border-border rounded-md bg-card',
      'shrink-0 transition-[width] duration-150',
      focused ? 'w-[200px]' : 'w-[140px]',
    )}>
      <Search size={13} strokeWidth={1.8} className="text-muted-foreground shrink-0" />
      <input
        type="text"
        placeholder="Search…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-foreground text-xs"
      />
      {query && (
        <button
          onClick={() => setQuery('')}
          className="flex items-center justify-center border-none bg-transparent p-0 cursor-pointer text-muted-foreground shrink-0"
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
  timelineName,
  onViewChange,
  onOpenFilterEditor,
  rightSlot,
}: Props) {
  return (
    <div className="flex items-center px-3 h-[var(--topbar-h)] bg-card border-b border-border shrink-0 z-10">
      {/* Left zone: view switcher */}
      <div className="flex-1 flex items-center justify-start">
        <div className="flex items-center gap-px bg-muted rounded-md p-0.5 shrink-0">
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={cn(
                'flex items-center justify-center gap-[5px]',
                'text-xs font-semibold px-2.5 py-1 rounded-[5px]',
                'border-none cursor-pointer',
                view === v.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground',
              )}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center zone: timeline name — truncates with ellipsis when narrow */}
      <div className="flex-1 min-w-0 flex items-center justify-center px-3">
        <span
          title={timelineName}
          className="text-xs font-medium text-muted-foreground truncate select-none"
        >
          {timelineName}
        </span>
      </div>

      {/* Right zone: Global actions */}
      <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
        <SearchInput />
        <FilterDropdown teamId={teamId} onOpenEditor={onOpenFilterEditor} />
        {rightSlot}
      </div>
    </div>
  );
}
