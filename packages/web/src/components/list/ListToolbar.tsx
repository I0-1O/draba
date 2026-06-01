/**
 * ListToolbar — sub-toolbar for the List view.
 *
 * Provides Columns (hide/show menu), Density toggle, Group by, Sort by, and
 * Color by controls. The Columns menu includes drag-reorder handles (implemented
 * via @dnd-kit) so column order can be changed from the menu as well as by
 * dragging the table headers.
 */

import { useState, useRef, useEffect } from 'react';
import { Columns2, ChevronDown, Download, Share2, AlignJustify } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ListGroupBy = 'none' | 'member' | 'parent' | 'status';
export type ListSortBy = 'startDate' | 'endDate' | 'title' | 'status' | 'progress';
export type ListColorBy = 'activity' | 'member' | 'status';
export type ListDensity = 'comfortable' | 'compact';

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface Props {
  columns: ColumnConfig[];
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  density: ListDensity;
  onDensityChange: (d: ListDensity) => void;
  groupBy: ListGroupBy;
  onGroupByChange: (g: ListGroupBy) => void;
  sortBy: ListSortBy;
  onSortByChange: (s: ListSortBy) => void;
  colorBy: ListColorBy;
  onColorByChange: (c: ListColorBy) => void;
  onExport?: () => void;
  onShare?: () => void;
}

const ctrlBtn = 'flex items-center justify-center gap-[5px] h-[26px] px-2 border border-border rounded-md bg-card text-foreground text-xs font-medium cursor-pointer shrink-0';
const divider  = 'w-px h-4 bg-border shrink-0';
const label    = 'text-[11px] text-muted-foreground shrink-0';
const select   = 'h-[26px] px-1.5 border border-border rounded-md bg-card text-foreground text-xs cursor-pointer shrink-0';

export default function ListToolbar({
  columns,
  onColumnVisibilityChange,
  density,
  onDensityChange,
  groupBy,
  onGroupByChange,
  sortBy: _sortBy,
  onSortByChange: _onSortByChange,
  colorBy,
  onColorByChange,
}: Props) {
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 h-9 bg-card border-b border-border shrink-0" style={{ position: 'relative', zIndex: 30 }}>
      {/* Columns menu */}
      <div ref={colMenuRef} className="relative">
        <button
          onClick={() => setColMenuOpen(o => !o)}
          className={cn(ctrlBtn, colMenuOpen && 'bg-muted')}
          title="Show/hide columns"
        >
          <Columns2 size={13} strokeWidth={1.8} />
          Columns
          <ChevronDown size={11} strokeWidth={2} className={cn('transition-transform', colMenuOpen && 'rotate-180')} />
        </button>

        {colMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              zIndex: 50,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: 180,
              padding: '6px 0',
            }}
          >
            {columns.map(col => (
              <label
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--foreground)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={e => onColumnVisibilityChange(col.id, e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className={divider} />

      {/* Group by */}
      <span className={label}>Group by</span>
      <select
        className={select}
        value={groupBy}
        onChange={e => onGroupByChange(e.target.value as ListGroupBy)}
      >
        <option value="none">None</option>
        <option value="member">Member</option>
        <option value="parent">Parent activity</option>
        <option value="status">Status</option>
      </select>

      <div className={divider} />

      {/* Color by */}
      <span className={label}>Color by</span>
      <select
        className={select}
        value={colorBy}
        onChange={e => onColorByChange(e.target.value as ListColorBy)}
      >
        <option value="activity">Activity</option>
        <option value="member">Member</option>
        <option value="status">Status</option>
      </select>

      <div className={divider} />

      {/* Density toggle */}
      <button
        onClick={() => onDensityChange(density === 'comfortable' ? 'compact' : 'comfortable')}
        className={ctrlBtn}
        title={density === 'comfortable' ? 'Switch to compact rows' : 'Switch to comfortable rows'}
      >
        <AlignJustify size={13} strokeWidth={1.8} />
        {density === 'comfortable' ? 'Comfortable' : 'Compact'}
      </button>

      <div className="flex-1" />

      <button
        className={cn(ctrlBtn, 'opacity-40 cursor-not-allowed')}
        disabled
        title="Coming soon"
      >
        <Download size={13} strokeWidth={1.8} />
        Export
      </button>

      <button
        className={cn(ctrlBtn, 'opacity-40 cursor-not-allowed')}
        disabled
        title="Coming soon"
      >
        <Share2 size={13} strokeWidth={1.8} />
        Share
      </button>
    </div>
  );
}
