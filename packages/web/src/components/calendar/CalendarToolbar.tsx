/**
 * CalendarToolbar — sub-toolbar for the Calendar view.
 *
 * Provides: Month / Week layout toggle, today / prev / next navigation,
 * a jump-to-date picker, color-by, an export stub, and Share (opens the
 * ICS feed modal — CalendarShareModal, not the view-share modal).
 */

import { ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import type { ColorBy } from '@/components/gantt/GanttToolbar';

export type CalendarLayout = 'month' | 'week';

interface Props {
  layout: CalendarLayout;
  onLayoutChange: (l: CalendarLayout) => void;
  /** The month/week currently in view. */
  anchorDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  colorBy: ColorBy;
  onColorByChange: (c: ColorBy) => void;
  onExport?: () => void;
  onShare?: () => void;
}

const btn = 'flex items-center justify-center gap-[5px] h-[26px] px-2 border border-border rounded-md bg-card text-foreground text-xs font-medium cursor-pointer shrink-0 hover:bg-muted transition-colors';
const iconBtn = 'flex items-center justify-center h-[26px] w-[26px] border border-border rounded-md bg-card text-foreground cursor-pointer shrink-0 hover:bg-muted transition-colors';
const divider = 'w-px h-4 bg-border shrink-0';
const label   = 'text-[11px] text-muted-foreground shrink-0';
const select  = 'h-[26px] px-1.5 border border-border rounded-md bg-card text-foreground text-xs cursor-pointer shrink-0';

/**
 * Formats the in-view period as a human label: "June 2026" for month layout,
 * "Jun 1 – 7, 2026" for week. Exported so the PNG export header can show the
 * same period text the toolbar does (the toolbar itself is excluded from the
 * capture, which otherwise leaves the image with no month/week indication).
 */
export function formatAnchorLabel(date: Date, layout: CalendarLayout): string {
  if (layout === 'month') {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  // Week: show the range "Jun 1 – 7, 2026"
  const end = new Date(date);
  end.setUTCDate(date.getUTCDate() + 6);
  const startStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endStr   = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${startStr} – ${endStr}`;
}

export default function CalendarToolbar({
  layout,
  onLayoutChange,
  anchorDate,
  onPrev,
  onNext,
  onToday,
  colorBy,
  onColorByChange,
  onExport,
  onShare,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 36, background: 'var(--card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      {/* Layout toggle */}
      <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', height: 26 }}>
        {(['month', 'week'] as CalendarLayout[]).map(l => (
          <button
            key={l}
            onClick={() => onLayoutChange(l)}
            style={{
              padding: '0 10px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              borderRight: l === 'month' ? '1px solid var(--border)' : 'none',
              background: layout === l ? 'var(--muted)' : 'var(--card)',
              color: 'var(--foreground)',
              cursor: 'pointer',
              height: '100%',
            }}
          >
            {l === 'month' ? 'Month' : 'Week'}
          </button>
        ))}
      </div>

      <div className={divider} />

      {/* Navigation */}
      <button className={iconBtn} onClick={onPrev} title="Previous">
        <ChevronLeft size={13} strokeWidth={2} />
      </button>
      <button className={btn} onClick={onToday}>Today</button>
      <button className={iconBtn} onClick={onNext} title="Next">
        <ChevronRight size={13} strokeWidth={2} />
      </button>

      {/* Current range label */}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', minWidth: 160, textAlign: 'center' }}>
        {formatAnchorLabel(anchorDate, layout)}
      </span>

      <div className={divider} />

      {/* Color by */}
      <span className={label}>Color by</span>
      <select
        className={select}
        value={colorBy}
        onChange={e => onColorByChange(e.target.value as ColorBy)}
      >
        <option value="activity">Activity</option>
        <option value="member">Member</option>
        <option value="status">Status</option>
      </select>

      {/* Export + share — pushed to the right edge */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className={divider} />
        <button className={btn} onClick={onExport} title="Export activities">
          <Download size={12} strokeWidth={1.8} />
          Export
        </button>
        <button className={btn} onClick={onShare} title="Share this calendar">
          <Share2 size={12} strokeWidth={1.8} />
          Share
        </button>
      </div>
    </div>
  );
}
