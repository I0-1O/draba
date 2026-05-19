/**
 * GanttToolbar — the thin sub-toolbar that sits between the top bar and
 * the Gantt grid. Provides zoom (granularity), group-by, sort-by, and an
 * export stub.
 */

import { Download, Share2, Plus, Minus } from 'lucide-react';
import type { TimeGranularity } from './granularity';

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

const CTRL_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  height: 26,
  padding: '0 8px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  flexShrink: 0,
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 16,
  background: 'var(--border)',
  flexShrink: 0,
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--font-sans)',
  flexShrink: 0,
};

const SELECT: React.CSSProperties = {
  height: 26,
  padding: '0 6px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--card)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
  flexShrink: 0,
};

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
  const currentIndex = granularityMap.indexOf(granularity as any) !== -1 ? granularityMap.indexOf(granularity as any) : 0;
  const currentLabel = granularityLabels[currentIndex];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onGranularityChange(granularityMap[val] as TimeGranularity | 'auto');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 14px',
        height: 36,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Zoom (granularity) */}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 26 }}>
        <button
          onClick={() => { if (currentIndex > 0) onGranularityChange(granularityMap[currentIndex - 1] as TimeGranularity | 'auto') }}
          style={{ ...CTRL_BTN, padding: '0 2px', height: 22, border: 'none', background: 'transparent', color: currentIndex > 0 ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: currentIndex > 0 ? 'pointer' : 'default' }}
          disabled={currentIndex === 0}
          title="Zoom out"
        >
          <Minus size={14} />
        </button>

        <div style={{ position: 'relative', width: 80, height: 26, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 5, right: 5, top: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ width: 2, height: 6, background: 'var(--border)', borderRadius: 1 }} />
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={currentIndex}
            onChange={handleSliderChange}
            className="gantt-zoom-slider"
            style={{ width: '100%', cursor: 'pointer', margin: 0, position: 'relative', zIndex: 1 }}
            title={granularity.charAt(0).toUpperCase() + granularity.slice(1)}
          />
        </div>

        <button
          onClick={() => { if (currentIndex < 5) onGranularityChange(granularityMap[currentIndex + 1] as TimeGranularity | 'auto') }}
          style={{ ...CTRL_BTN, padding: '0 2px', height: 22, border: 'none', background: 'transparent', color: currentIndex < 5 ? 'var(--foreground)' : 'var(--muted-foreground)', cursor: currentIndex < 5 ? 'pointer' : 'default' }}
          disabled={currentIndex === 5}
          title="Zoom in"
        >
          <Plus size={14} />
        </button>

        <div
          title={granularity.charAt(0).toUpperCase() + granularity.slice(1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            fontWeight: currentLabel === 'A' ? 700 : 500,
            color: currentLabel === 'A' ? 'var(--primary)' : 'var(--muted-foreground)',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none'
          }}
        >
          {currentLabel}
        </div>
      </div>

      <div style={DIVIDER} />

      {/* Group by */}
      <span style={LABEL}>Group by</span>
      <select
        style={SELECT}
        value={groupBy}
        onChange={e => onGroupByChange(e.target.value as GroupBy)}
      >
        <option value="none">None</option>
        <option value="member">Member</option>
        <option value="parent">Parent event</option>
      </select>

      <div style={DIVIDER} />

      {/* Sort by */}
      <span style={LABEL}>Sort by</span>
      <select
        style={SELECT}
        value={sortBy}
        onChange={e => onSortByChange(e.target.value as SortBy)}
      >
        <option value="startDate">Start date</option>
        <option value="endDate">End date</option>
        <option value="title">Title A–Z</option>
      </select>

      <div style={{ flex: 1 }} />

      {/* Export */}
      <button
        style={CTRL_BTN}
        onClick={onExport}
        title="Export events (coming soon)"
      >
        <Download size={13} strokeWidth={1.8} />
        Export
      </button>

      {/* Share */}
      <button
        style={CTRL_BTN}
        onClick={onShare}
        title="Share"
      >
        <Share2 size={13} strokeWidth={1.8} />
        Share
      </button>
    </div>
  );
}
