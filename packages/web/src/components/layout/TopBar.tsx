/**
 * Top toolbar above the active view. Left side: global app navigation
 * (view switcher) and global object actions (Share). Right side: global
 * cross-view actions: Find bar (or Search icon trigger), Filter dropdown,
 * then whatever the parent injects into `rightSlot` (typically the profile menu).
 *
 * View-specific controls (date nav, zoom) intentionally live elsewhere —
 * a context-sensitive sub-toolbar hosts them.
 */

import { Search, CalendarDays, GanttChart, Columns3, List } from 'lucide-react';
import FilterDropdown from '@/components/filters/FilterDropdown';
import FindBar from '@/components/layout/FindBar';
import { Badge } from '@/components/identity/Badge';
import { useFind } from '@/contexts/FindContext';
import { cn } from '@/lib/utils';
import type { Identity } from '@/components/identity/identity-constants';
import { DEFAULT_TIMELINE_IDENTITY } from '@/components/identity/identity-constants';

export type ViewMode = 'calendar' | 'gantt' | 'kanban' | 'list';

interface Props {
  view: ViewMode;
  teamId?: string;
  timelineName?: string;
  timelineIdentity?: Identity;
  onViewChange: (view: ViewMode) => void;
  onOpenFilterManager: () => void;
  rightSlot?: React.ReactNode;
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'list',     icon: <List size={13} strokeWidth={1.8} />,        label: 'List' },
  { id: 'calendar', icon: <CalendarDays size={13} strokeWidth={1.8} />, label: 'Calendar' },
  { id: 'gantt',    icon: <GanttChart size={13} strokeWidth={1.8} />,  label: 'Gantt' },
  { id: 'kanban',   icon: <Columns3 size={13} strokeWidth={1.8} />,    label: 'Kanban' },
];

export default function TopBar({
  view,
  teamId,
  timelineName,
  timelineIdentity,
  onViewChange,
  onOpenFilterManager,
  rightSlot,
}: Props) {
  const { findBarOpen, setFindBarOpen } = useFind();

  return (
    <div className="flex items-center px-3 h-[var(--topbar-h)] bg-card border-b border-border shrink-0 z-10">
      {/* Left zone: view switcher */}
      <div className="flex items-center justify-start shrink-0">
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

      {/* Center zone: timeline identity badge + name */}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3">
        <Badge
          identity={timelineIdentity ?? DEFAULT_TIMELINE_IDENTITY}
          name={timelineName ?? ''}
          shape="square"
          size={18}
          className="shrink-0"
        />
        <span
          title={timelineName}
          className="text-xs font-medium text-muted-foreground truncate select-none"
        >
          {timelineName}
        </span>
      </div>

      {/* Right zone: Find bar / trigger, Filter, profile slot */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 min-w-0">
        {findBarOpen ? (
          <FindBar />
        ) : (
          <button
            onClick={() => setFindBarOpen(true)}
            title="Find in view (Ctrl+F)"
            className={cn(
              'flex items-center justify-center w-7 h-7',
              'border border-border rounded-md bg-card',
              'cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted',
              'transition-colors shrink-0',
            )}
          >
            <Search size={13} strokeWidth={1.8} />
          </button>
        )}
        <FilterDropdown teamId={teamId} onOpenManager={onOpenFilterManager} />
        {rightSlot}
      </div>
    </div>
  );
}
