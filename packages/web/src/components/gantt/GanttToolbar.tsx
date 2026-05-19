/**
 * GanttToolbar — the thin sub-toolbar that sits between the top bar and
 * the Gantt grid. Provides zoom (granularity), group-by, sort-by, and an
 * export stub.
 */

import { Download } from 'lucide-react';
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
}: Props) {
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
      <span style={LABEL}>Zoom</span>
      <select
        style={SELECT}
        value={granularity}
        onChange={e => onGranularityChange(e.target.value as TimeGranularity | 'auto')}
      >
        <option value="auto">Auto</option>
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="month">Month</option>
        <option value="quarter">Quarter</option>
        <option value="year">Year</option>
      </select>

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
