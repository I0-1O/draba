/**
 * GanttToolbar — the thin sub-toolbar that sits between the top bar and
 * the Gantt grid. Provides zoom (granularity), group-by, sort-by, and an
 * export stub.
 */

import { Download, Share2, Plus, Minus } from 'lucide-react';
import type { TimeGranularity } from './granularity';
import { cn } from '@/lib/utils';

export type { TimeGranularity } from './granularity';
export type GroupBy = 'none' | 'member' | 'parent';
export type SortBy = 'startDate' | 'endDate' | 'title';

interface Props {
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  sortBy: SortBy;
  onSortByChange: (s: SortBy) => void;
  granularity: TimeGranularity | 'auto';
  onGranularityChange: (g: TimeGranularity | 'auto') => void;
  onExport: () => void;
  onShare?: () => void;
}

const ctrlBtn = 'flex items-center justify-center gap-[5px] h-[26px] px-2 border border-border rounded-md bg-card text-foreground text-xs font-medium cursor-pointer shrink-0';
const divider = 'w-px h-4 bg-border shrink-0';
const label   = 'text-[11px] text-muted-foreground shrink-0';
const select  = 'h-[26px] px-1.5 border border-border rounded-md bg-card text-foreground text-xs cursor-pointer shrink-0';

export default function GanttToolbar({
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  granularity,
  onGranularityChange,
  onExport,
  onShare,
}: Props) {
  const granularityMap = ['auto', 'day', 'week', 'month', 'quarter', 'year'] as const;
  const granularityLabels = ['A', 'D', 'W', 'M', 'Q', 'Y'];
  const currentIndex = granularityMap.indexOf(granularity as never) !== -1
    ? granularityMap.indexOf(granularity as never)
    : 0;
  const currentLabel = granularityLabels[currentIndex];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onGranularityChange(granularityMap[val] as TimeGranularity | 'auto');
  };

  return (
    <div className="flex items-center gap-2 px-3.5 h-9 bg-card border-b border-border shrink-0">
      {/* Custom range-input thumb/track styles — no Tailwind equivalent for pseudo-elements */}
      <style>{`
        .gantt-zoom-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
        }
        .gantt-zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
          cursor: pointer;
          margin-top: -4px;
        }
        .gantt-zoom-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--primary);
          cursor: pointer;
          border: none;
        }
        .gantt-zoom-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: var(--border);
          border-radius: 2px;
        }
        .gantt-zoom-slider::-moz-range-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: var(--border);
          border-radius: 2px;
        }
      `}</style>

      {/* Zoom (granularity) */}
      <div className="flex items-center gap-1.5 h-[26px]">
        <button
          onClick={() => { if (currentIndex > 0) onGranularityChange(granularityMap[currentIndex - 1] as TimeGranularity | 'auto'); }}
          disabled={currentIndex === 0}
          title="Zoom out"
          className={cn(
            'flex items-center justify-center border-none bg-transparent h-[22px] px-0.5',
            currentIndex > 0 ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-default',
          )}
        >
          <Minus size={14} />
        </button>

        <div className="relative w-20 h-[26px] flex items-center">
          <div className="absolute inset-x-[5px] inset-y-0 flex justify-between items-center pointer-events-none">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="w-0.5 h-1.5 bg-border rounded-[1px]" />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={currentIndex}
            onChange={handleSliderChange}
            className="gantt-zoom-slider w-full cursor-pointer m-0 relative z-10"
            title={granularity.charAt(0).toUpperCase() + granularity.slice(1)}
          />
        </div>

        <button
          onClick={() => { if (currentIndex < 5) onGranularityChange(granularityMap[currentIndex + 1] as TimeGranularity | 'auto'); }}
          disabled={currentIndex === 5}
          title="Zoom in"
          className={cn(
            'flex items-center justify-center border-none bg-transparent h-[22px] px-0.5',
            currentIndex < 5 ? 'text-foreground cursor-pointer' : 'text-muted-foreground cursor-default',
          )}
        >
          <Plus size={14} />
        </button>

        <div
          title={granularity.charAt(0).toUpperCase() + granularity.slice(1)}
          className={cn(
            'flex items-center justify-center w-[22px] h-[22px]',
            'bg-card border border-border rounded-sm text-xs font-mono select-none',
            currentLabel === 'A' ? 'font-bold text-primary' : 'font-medium text-muted-foreground',
          )}
        >
          {currentLabel}
        </div>
      </div>

      <div className={divider} />

      {/* Group by */}
      <span className={label}>Group by</span>
      <select
        className={select}
        value={groupBy}
        onChange={e => onGroupByChange(e.target.value as GroupBy)}
      >
        <option value="none">None</option>
        <option value="member">Member</option>
        <option value="parent">Parent event</option>
      </select>

      <div className={divider} />

      {/* Sort by */}
      <span className={label}>Sort by</span>
      <select
        className={select}
        value={sortBy}
        onChange={e => onSortByChange(e.target.value as SortBy)}
      >
        <option value="startDate">Start date</option>
        <option value="endDate">End date</option>
        <option value="title">Title A–Z</option>
      </select>

      <div className="flex-1" />

      <button className={ctrlBtn} onClick={onExport} title="Export events (coming soon)">
        <Download size={13} strokeWidth={1.8} />
        Export
      </button>

      <button className={ctrlBtn} onClick={onShare} title="Share">
        <Share2 size={13} strokeWidth={1.8} />
        Share
      </button>
    </div>
  );
}
