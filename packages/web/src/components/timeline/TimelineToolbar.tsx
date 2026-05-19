/**
 * TimelineToolbar — the thin sub-toolbar that sits between the top bar and
 * the Gantt grid. Provides zoom, group-by, sort-by, and an export stub.
 */

import { Minus, Plus, Download } from 'lucide-react';

export type GroupBy = 'none' | 'member' | 'parent';
export type SortBy = 'startDate' | 'endDate' | 'title';

/** Ordered zoom steps in px-per-day. */
export const COL_WIDTHS = [40, 60, 80, 120, 160] as const;
export type ColWidth = (typeof COL_WIDTHS)[number];

interface Props {
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  sortBy: SortBy;
  onSortByChange: (s: SortBy) => void;
  colWidth: ColWidth;
  onZoomChange: (w: ColWidth) => void;
  onExport: () => void;
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

const ZOOM_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  border: 'none',
  background: 'none',
  color: 'var(--muted-foreground)',
  cursor: 'pointer',
  padding: 0,
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

export default function TimelineToolbar({
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  colWidth,
  onZoomChange,
  onExport,
}: Props) {
  const zoomIdx = COL_WIDTHS.indexOf(colWidth);

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
      {/* Zoom slider */}
      <button
        style={{ ...ZOOM_BTN, opacity: zoomIdx > 0 ? 1 : 0.3 }}
        onClick={() => zoomIdx > 0 && onZoomChange(COL_WIDTHS[zoomIdx - 1])}
        title="Zoom out"
      >
        <Minus size={13} strokeWidth={2.5} />
      </button>
      <input
        type="range"
        min={0}
        max={COL_WIDTHS.length - 1}
        step={1}
        value={zoomIdx}
        onChange={e => onZoomChange(COL_WIDTHS[Number(e.target.value)])}
        title={`Zoom: ${colWidth}px/day`}
        style={{ width: 80, cursor: 'pointer', accentColor: 'var(--primary)' }}
      />
      <button
        style={{ ...ZOOM_BTN, opacity: zoomIdx < COL_WIDTHS.length - 1 ? 1 : 0.3 }}
        onClick={() => zoomIdx < COL_WIDTHS.length - 1 && onZoomChange(COL_WIDTHS[zoomIdx + 1])}
        title="Zoom in"
      >
        <Plus size={13} strokeWidth={2.5} />
      </button>

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
    </div>
  );
}
