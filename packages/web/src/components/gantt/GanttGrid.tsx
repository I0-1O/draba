/**
 * GanttGrid — presentational Gantt chart.
 *
 * Renders a sticky header row of column labels, then one row per GanttRow
 * entry. Rows are either group-header dividers or event bars. All data
 * preparation (grouping, sorting, date math) lives in the parent GanttView.
 *
 * Drag on an empty lane cell to select a date range; onLaneDrag fires on
 * mouseup with the resolved start/end dates and the lane's memberId.
 *
 * Drag on an event bar's left/right 8px edge to resize it, or on its body to
 * move it. onBarDrag fires on mouseup with the resolved new dates.
 *
 * When findState is provided with a non-empty query, non-matching event rows
 * are dimmed to 0.3 opacity; matching rows get an amber outline on their bar;
 * the active (parked) match gets a stronger amber outline with a pulse
 * animation. Stepping to a new active match auto-scrolls both axes to center
 * the bar in the viewport.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import MemberAvatar from '../MemberAvatar';
import { Badge } from '../identity/Badge';
import EmptyState from '../shared/EmptyState';
import type { Member } from '../../types';
import type { ColumnDef, TimeGranularity } from './granularity';
import { addDays } from './granularity';

const DEFAULT_LABEL_COL_W = 240;
const MIN_LABEL_COL_W = 140;
const MAX_LABEL_COL_W = 400;
const HEADER_H = 36;
const ROW_H = 44;
const GROUP_H = 30;
const COL_W = 80;
const EDGE_W = 8; // px hit zone for resize handles

/** A positioned activity bar ready for rendering. */
export interface GanttActivity {
  id: string;
  title: string;
  /** Fractional column start (0-based). */
  startCol: number;
  /** Fractional column span. */
  span: number;
  /** Hex color for bar background and badge. */
  color: string;
  /** Icon ID from the activity's identity, if set. */
  icon?: string;
  members: Member[];
  isChild: boolean;
}

export type GanttRow =
  | { kind: 'group'; id: string; label: string; color: string; count: number }
  | { kind: 'activity'; event: GanttActivity };

/** Visual state for the in-view Find feature. Passed from GanttView. */
export interface FindState {
  hasQuery: boolean;
  matchedIds: Set<string>;
  activeMatchId: string | null;
  /** Per-event match reasons for "why matched" tooltip (non-title reasons only). */
  matchReasons: Map<string, string[]>;
  filtersActive: boolean;
  matchCount: number;
}

interface DragState {
  rowIdx: number;
  memberId: string | null;
  startCol: number;
  currentCol: number;
}

type BarDragZone = 'left' | 'right' | 'body';

interface BarDragState {
  eventId: string;
  zone: BarDragZone;
  /** Fractional column of the event's visual start when drag began. */
  initStartCol: number;
  /** Fractional column of the event's visual end (startCol + span) when drag began. */
  initEndCol: number;
  /** Lane-relative x of the mouse when drag began. */
  initMouseX: number;
  /** Page-relative left edge of the lane div. */
  laneLeft: number;
  /** Current snapped start column (integer). */
  snapStartCol: number;
  /** Current snapped end column (integer, exclusive — col after last occupied). */
  snapEndCol: number;
}

interface TooltipState {
  text: string;
  /** Viewport-relative x for tooltip positioning. */
  x: number;
  /** Viewport-relative y for tooltip positioning. */
  y: number;
}

/** Tooltip shown when hovering a matched event bar that matched on a non-title field. */
interface MatchTooltipState {
  reasons: string[];
  x: number;
  y: number;
}

interface Props {
  rows: GanttRow[];
  columns: ColumnDef[];
  /** Fractional column index of today (-1 if outside range). */
  todayIndex: number;
  selectedActivityId: string | null;
  onSelectActivity: (id: string | null) => void;
  /** Called when the user drags on an empty lane cell to create an activity. */
  onLaneDrag?: (startDate: Date, endDate: Date, memberId: string | null) => void;
  /** Called when the user drags a bar edge or body to resize/move it. */
  onBarDrag?: (activityId: string, newStartDate: Date, newEndDate: Date) => void;
  /** Called during a bar drag with the current snapped dates — for live sidebar update. */
  onBarDragProgress?: (activityId: string, newStartDate: Date, newEndDate: Date) => void;
  /** Resolved granularity — used to compute the finer snap divisor during drag. */
  resolvedGranularity?: TimeGranularity | 'auto';
  /** Find state from GanttView; absent when the find bar is closed/idle. */
  findState?: FindState;
  /** Called when the user clicks "Clear filters" in the no-matches callout. */
  onClearFilters?: () => void;
}

// ── Bar drag helpers ─────────────────────────────────────────────────────────

function tooltipText(zone: BarDragZone, startDate: Date, endDate: Date): string {
  if (zone === 'left') return `Start: ${formatDragDate(startDate)}`;
  if (zone === 'right') return `End: ${formatDragDate(endDate)}`;
  return `${formatDragDate(startDate)} → ${formatDragDate(endDate)}`;
}

// ── Date helpers (support fractional column positions) ───────────────────────

// Maps a fractional column position to a calendar Date by interpolating within
// the column's day range. Fractional positions enable finer snap granularities.
function colFracToDate(colFrac: number, columns: ColumnDef[]): Date {
  let remaining = Math.max(0, colFrac);
  for (const col of columns) {
    if (remaining <= 1) {
      return addDays(col.start, Math.round(remaining * col.days));
    }
    remaining -= 1;
  }
  return columns[columns.length - 1].end;
}

function colToStartDate(colFrac: number, columns: ColumnDef[]): Date {
  return colFracToDate(Math.max(0, colFrac), columns);
}

// endColFrac is exclusive (the fractional col just past the last occupied day).
function colToEndDate(endColFrac: number, columns: ColumnDef[]): Date {
  // The last included date is 1 day before the date at the exclusive end.
  return addDays(colFracToDate(Math.max(0, endColFrac), columns), -1);
}

// Number of snap divisions per column based on the active zoom granularity.
// Higher divisor → finer snap (e.g. week columns snap to day boundaries).
function snapDivisorFor(granularity: TimeGranularity | 'auto'): number {
  switch (granularity) {
    case 'week':    return 7;  // snap to day within week
    case 'month':   return 4;  // snap to week within month
    case 'quarter': return 3;  // snap to month within quarter
    case 'year':    return 4;  // snap to quarter within year
    default:        return 1;  // day or auto → no finer snap
  }
}

function formatDragDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GanttGrid({
  rows,
  columns,
  todayIndex,
  selectedActivityId,
  onSelectActivity,
  onLaneDrag,
  onBarDrag,
  onBarDragProgress,
  resolvedGranularity,
  findState,
  onClearFilters,
}: Props) {
  // ── Resizable label column ─────────────────────────────────────────────────
  const [labelColW, setLabelColW] = useState(DEFAULT_LABEL_COL_W);

  const totalW = useMemo(
    () => labelColW + columns.length * COL_W,
    [labelColW, columns.length],
  );

  const labelColWRef = useRef(labelColW);
  useEffect(() => { labelColWRef.current = labelColW; }, [labelColW]);

  const handleColumnResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = labelColWRef.current;

    function onMouseMove(mv: MouseEvent) {
      const next = Math.max(MIN_LABEL_COL_W, Math.min(MAX_LABEL_COL_W, startW + (mv.clientX - startX)));
      setLabelColW(next);
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  // Integer column index that contains today (for background highlight)
  const todayCol = todayIndex >= 0 ? Math.floor(todayIndex) : -1;

  // ── Scroll container ref (needed for find auto-scroll) ────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Always-current rows ref so the active-match scroll effect doesn't go stale
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; });

  // ── Drag-to-create state ──────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // ── Bar drag state ────────────────────────────────────────────────────────
  const [barDrag, setBarDrag] = useState<BarDragState | null>(null);
  const barDragRef = useRef<BarDragState | null>(null);
  const [dragTooltip, setDragTooltip] = useState<TooltipState | null>(null);

  // ── "Why matched" hover tooltip ───────────────────────────────────────────
  const [matchTooltip, setMatchTooltip] = useState<MatchTooltipState | null>(null);

  const colFromX = useCallback((laneX: number) => {
    return Math.max(0, Math.min(columns.length - 1, Math.floor(laneX / COL_W)));
  }, [columns.length]);

  // ── Auto-scroll to active find match ─────────────────────────────────────
  useEffect(() => {
    const activeId = findState?.activeMatchId;
    if (!activeId || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const currentRows = rowsRef.current;

    let y = HEADER_H;
    let matchedActivity: GanttActivity | null = null;
    for (const row of currentRows) {
      if (row.kind === 'activity' && row.event.id === activeId) {
        matchedActivity = row.event;
        break;
      }
      y += row.kind === 'group' ? GROUP_H : ROW_H;
    }
    if (!matchedActivity) return;

    const viewH = container.clientHeight;
    const viewW = container.clientWidth;
    const scrollTop = Math.max(0, y - viewH / 2 + ROW_H / 2);
    const eventCenterX = labelColWRef.current + (matchedActivity.startCol + matchedActivity.span / 2) * COL_W;
    const scrollLeft = Math.max(0, eventCenterX - viewW / 2);

    container.scrollTo({ left: scrollLeft, top: scrollTop, behavior: 'smooth' });
  // Only re-run when the active match changes, not when rows or columns change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findState?.activeMatchId]);

  const handleLaneMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    rowIdx: number,
    memberId: string | null,
  ) => {
    if (!onLaneDrag) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const col = colFromX(e.clientX - rect.left);
    const state: DragState = { rowIdx, memberId, startCol: col, currentCol: col };
    dragRef.current = state;
    setDrag(state);

    function onMouseMove(mv: MouseEvent) {
      if (!dragRef.current) return;
      const col2 = colFromX(mv.clientX - rect.left);
      const next = { ...dragRef.current, currentCol: col2 };
      dragRef.current = next;
      setDrag({ ...next });
    }

    function onMouseUp() {
      const s = dragRef.current;
      if (s && onLaneDrag && columns.length > 0) {
        const lo = Math.min(s.startCol, s.currentCol);
        const hi = Math.max(s.startCol, s.currentCol);
        const startDate = columns[lo]?.start ?? columns[0].start;
        const endDate = columns[hi]?.start ?? columns[hi > 0 ? hi : 0].start;
        onLaneDrag(startDate, endDate, s.memberId);
      }
      dragRef.current = null;
      setDrag(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [colFromX, columns, onLaneDrag]);

  // ── Bar drag handler ──────────────────────────────────────────────────────

  const handleBarMouseDown = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    ev: GanttActivity,
    zone: BarDragZone,
  ) => {
    if (!onBarDrag) return;
    // Only allow drag/resize when the bar is already selected.
    if (ev.id !== selectedActivityId) return;
    e.preventDefault();
    e.stopPropagation(); // prevent lane-drag from firing

    // The bar's parent is the lane div (position: relative, flex: 1).
    const laneEl = e.currentTarget.parentElement;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();

    const initStartCol = ev.startCol;
    const initEndCol = ev.startCol + ev.span;
    const initMouseX = e.clientX - laneRect.left;
    // Snap initial positions using finer step.
    const div = snapDivisorFor(resolvedGranularity ?? 'auto');
    const step = 1 / div;
    const snapInit = (x: number) => Math.round(x / step) * step;
    const initSnapStart = snapInit(initStartCol);
    const initSnapEnd = snapInit(initEndCol);

    const state: BarDragState = {
      eventId: ev.id,
      zone,
      initStartCol,
      initEndCol,
      initMouseX,
      laneLeft: laneRect.left,
      snapStartCol: initSnapStart,
      snapEndCol: Math.max(initSnapEnd, initSnapStart + step),
    };
    barDragRef.current = state;
    setBarDrag(state);

    // Initial tooltip
    const startDate = colToStartDate(state.snapStartCol, columns);
    const endDate = colToEndDate(state.snapEndCol, columns);
    setDragTooltip({
      text: tooltipText(zone, startDate, endDate),
      x: e.clientX,
      y: e.clientY,
    });

    function onMouseMove(mv: MouseEvent) {
      const s = barDragRef.current;
      if (!s) return;

      const deltaCol = (mv.clientX - (s.laneLeft + s.initMouseX)) / COL_W;
      const n = columns.length;
      // Finer snap: snap one granularity level below the active zoom.
      const div = snapDivisorFor(resolvedGranularity ?? 'auto');
      const step = 1 / div;
      const snap = (x: number) => Math.round(x / step) * step;

      let nextStart = s.snapStartCol;
      let nextEnd = s.snapEndCol;

      if (s.zone === 'left') {
        nextStart = Math.max(0, Math.min(snap(s.initStartCol + deltaCol), s.snapEndCol - step));
      } else if (s.zone === 'right') {
        nextEnd = Math.max(s.snapStartCol + step, Math.min(snap(s.initEndCol + deltaCol), n));
      } else {
        // body: preserve span, shift both
        const span = Math.max(step, snap(s.initEndCol - s.initStartCol));
        const shift = snap(deltaCol);
        nextStart = Math.max(0, Math.min(snap(s.initStartCol) + shift, n - span));
        nextEnd = nextStart + span;
      }

      const next: BarDragState = { ...s, snapStartCol: nextStart, snapEndCol: nextEnd };
      barDragRef.current = next;
      setBarDrag(next);

      const sd = colToStartDate(nextStart, columns);
      const ed = colToEndDate(nextEnd, columns);
      setDragTooltip({ text: tooltipText(s.zone, sd, ed), x: mv.clientX, y: mv.clientY });
      onBarDragProgress?.(s.eventId, sd, ed);
    }

    function onMouseUp() {
      const s = barDragRef.current;
      if (s && onBarDrag) {
        const sd = colToStartDate(s.snapStartCol, columns);
        const ed = colToEndDate(s.snapEndCol, columns);
        onBarDrag(s.eventId, sd, ed); // eventId field preserved in BarDragState
      }
      barDragRef.current = null;
      setBarDrag(null);
      setDragTooltip(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [columns, onBarDrag]);

  // Header cells are shared between the empty-state path and the unified scroll path.
  const headerContent = (
    <>
      <div
        style={{
          width: labelColW,
          flexShrink: 0,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          borderRight: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted-foreground)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          position: 'sticky' as const,
          left: 0,
          zIndex: 6,
          background: 'var(--card)',
          userSelect: 'none',
        }}
      >
        Activity
        {/* Drag handle — resize the label column */}
        <div
          onMouseDown={handleColumnResizeMouseDown}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 6,
            cursor: 'col-resize',
            zIndex: 10,
          }}
        />
      </div>

      {columns.map((col, i) => {
        const isToday = i === todayCol;
        return (
          <div
            key={i}
            style={{
              width: COL_W,
              flexShrink: 0,
              height: HEADER_H,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px 8px',
              gap: 2,
              borderRight: i < columns.length - 1 ? '1px solid var(--border)' : 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <span style={{
              fontSize: col.sublabel ? 10 : 11,
              fontWeight: isToday ? 700 : 600,
              color: isToday ? 'var(--primary)' : 'var(--muted-foreground)',
              lineHeight: 1.2,
              textAlign: 'center',
            }}>
              {col.label}
            </span>
            {col.sublabel && (
              <span style={{
                fontSize: 9,
                fontWeight: 500,
                color: 'var(--muted-foreground)',
                lineHeight: 1,
                opacity: isToday ? 1 : 0.75,
              }}>
                {col.sublabel}
              </span>
            )}
            {isToday && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  left: `${((todayIndex - todayCol) * 100)}%`,
                  transform: 'translateX(-50%)',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--secondary)',
                }}
              />
            )}
          </div>
        );
      })}
    </>
  );

  // ── Find helpers ──────────────────────────────────────────────────────────

  const { hasQuery = false, matchedIds: matchSet, activeMatchId, matchReasons: reasons } = findState ?? {};

  function isMatch(id: string) { return matchSet?.has(id) ?? false; }
  function isActive(id: string) { return activeMatchId === id; }

  // Non-title reasons to surface in the "why matched" tooltip
  function nonTitleReasons(id: string): string[] {
    return (reasons?.get(id) ?? []).filter(r => r !== 'title');
  }

  // ── Empty state: header + centered placeholder ──────────────────────────────
  if (rows.length === 0) {
    const showNoMatchCallout = hasQuery && findState && findState.matchCount === 0;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
          <div style={{ width: totalW, display: 'flex', height: HEADER_H, background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
            {headerContent}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <EmptyState message="No viewable activities" />
          {showNoMatchCallout && findState.filtersActive && (
            <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
              No matches in current view.{' '}
              {onClearFilters && (
                <button
                  onClick={onClearFilters}
                  style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}
                >
                  Clear filters
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Unified scroll: header sticky inside the single container ──────────────
  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ width: totalW }}>

          {/* Sticky header row — scrolls horizontally with the grid, pins to top vertically */}
          <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', height: HEADER_H, background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
            {headerContent}
          </div>

          {rows.map((row, rowIdx) => {
            if (row.kind === 'group') {
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    height: GROUP_H,
                    background: 'var(--muted)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: labelColW,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '0 14px',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--muted)',
                      zIndex: 3,
                      borderRight: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 2,
                        background: row.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--foreground)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--muted-foreground)',
                        flexShrink: 0,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {row.count}
                    </span>
                  </div>
                  <div style={{ flex: 1 }} />
                </div>
              );
            }

            const ev = row.event;
            const selected = selectedActivityId === ev.id;
            const indent = ev.isChild ? 20 : 0;
            const evIsMatch = isMatch(ev.id);
            const evIsActive = isActive(ev.id);
            const dimmed = hasQuery && !evIsMatch;
            const extraReasons = nonTitleReasons(ev.id);

            return (
              <div
                key={`${ev.id}-${rowIdx}`}
                style={{
                  display: 'flex',
                  height: ROW_H,
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                  background: selected ? 'hsl(188 59% 38% / .04)' : 'transparent',
                  opacity: dimmed ? 0.3 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {/* Sticky label cell */}
                <div
                  style={{
                    width: LABEL_COL_W,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    paddingLeft: 14 + indent,
                    paddingRight: 10,
                    position: 'sticky',
                    left: 0,
                    background: selected ? 'var(--muted)' : 'var(--card)',
                    zIndex: 6,
                    borderRight: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => onSelectActivity(ev.id === selectedActivityId ? null : ev.id)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--muted)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selected ? 'var(--muted)' : 'var(--card)';
                  }}
                >
                  <Badge
                    identity={{ color: ev.color, icon: ev.icon ?? '__none__' }}
                    name={ev.title}
                    shape="square"
                    size={20}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--foreground)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {ev.title}
                  </span>
                  {ev.members.length > 0 && (
                    <div style={{ display: 'flex', flexShrink: 0 }}>
                      {ev.members.slice(0, 3).map((m, i) => (
                        <div
                          key={m.id}
                          style={{ marginLeft: i === 0 ? 0 : -5 }}
                          title={m.name}
                        >
                          <MemberAvatar member={m} size={20} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lane — background columns + today line + event bar */}
                <div
                  style={{ position: 'relative', flex: 1, display: 'flex', cursor: onLaneDrag ? 'crosshair' : 'default' }}
                  onMouseDown={e => handleLaneMouseDown(e, rowIdx, ev.members[0]?.id ?? null)}
                >
                  {columns.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: COL_W,
                        height: '100%',
                        flexShrink: 0,
                        borderRight: i < columns.length - 1 ? '1px solid var(--border)' : 'none',
                        background:
                          i === todayCol && !selected ? 'hsl(188 59% 38% / .04)' : 'transparent',
                      }}
                    />
                  ))}

                  {/* Drag selection highlight */}
                  {drag && drag.rowIdx === rowIdx && (() => {
                    const lo = Math.min(drag.startCol, drag.currentCol);
                    const hi = Math.max(drag.startCol, drag.currentCol);
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          bottom: 4,
                          left: lo * COL_W,
                          width: (hi - lo + 1) * COL_W,
                          background: 'hsl(188 59% 38% / .18)',
                          border: '1.5px dashed var(--primary)',
                          borderRadius: 4,
                          pointerEvents: 'none',
                          zIndex: 3,
                        }}
                      />
                    );
                  })()}

                  {/* Today vertical line */}
                  {todayIndex >= 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: todayIndex * COL_W,
                        width: 2,
                        background: 'var(--secondary)',
                        opacity: 0.5,
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                    />
                  )}

                  {/* Event bar — live position overridden while dragging */}
                  {(() => {
                    const isDragging = barDrag?.eventId === ev.id;
                    const startCol = isDragging ? barDrag!.snapStartCol : ev.startCol;
                    const endCol = isDragging ? barDrag!.snapEndCol : ev.startCol + ev.span;
                    const left = startCol * COL_W + 2;
                    const width = Math.max((endCol - startCol) * COL_W - 4, COL_W * 0.3);
                    // Only selected bars show grab/move cursors; unselected bars show pointer
                    // to prevent accidental date changes when the user just wants to inspect.
                    const grabCursor = isDragging
                      ? 'grabbing'
                      : (selected && onBarDrag) ? 'grab' : 'pointer';

                    // Box shadow: find states take precedence over selection ring.
                    // CSS classes (.find-active-bar, .find-match-bar) provide the
                    // amber outline; we only set inline boxShadow for the selected ring.
                    const boxShadow = (evIsActive || evIsMatch)
                      ? undefined
                      : selected
                        ? `0 0 0 2px white, 0 0 0 4px ${ev.color}`
                        : 'var(--shadow-sm)';

                    return (
                      <div
                        onClick={() => {
                          // Bar click always selects — use the label cell to deselect.
                          if (!isDragging) onSelectActivity(ev.id);
                        }}
                        onMouseDown={e => {
                          if (!onBarDrag) { e.stopPropagation(); return; }
                          const barRect = e.currentTarget.getBoundingClientRect();
                          const xInBar = e.clientX - barRect.left;
                          let zone: BarDragZone;
                          if (xInBar <= EDGE_W) zone = 'left';
                          else if (xInBar >= barRect.width - EDGE_W) zone = 'right';
                          else zone = 'body';
                          handleBarMouseDown(e, ev, zone);
                        }}
                        onMouseEnter={e => {
                          if (!isDragging) e.currentTarget.style.filter = 'brightness(1.08)';
                          // Show "why matched" tooltip for non-title matches
                          if (extraReasons.length > 0) {
                            setMatchTooltip({ reasons: extraReasons, x: e.clientX, y: e.clientY });
                          }
                        }}
                        onMouseMove={e => {
                          if (matchTooltip) {
                            setMatchTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null);
                          }
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.filter = '';
                          setMatchTooltip(null);
                        }}
                        className={evIsActive ? 'find-active-bar' : evIsMatch ? 'find-match-bar' : undefined}
                        style={{
                          position: 'absolute',
                          top: 9,
                          bottom: 9,
                          left,
                          width,
                          background: ev.color,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          padding: `0 ${EDGE_W + 2}px`,
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'white',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          cursor: grabCursor,
                          zIndex: 4,
                          boxShadow,
                          opacity: isDragging ? 0.85 : 1,
                          transition: isDragging ? 'none' : 'box-shadow 0.12s, opacity 0.1s',
                          fontFamily: 'var(--font-sans)',
                          userSelect: 'none',
                        }}
                      >
                        {/* Left resize handle — only shown on selected bars */}
                        {onBarDrag && selected && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: EDGE_W,
                              cursor: 'ew-resize',
                              borderRadius: '5px 0 0 5px',
                            }}
                          />
                        )}
                        {ev.title}
                        {/* Right resize handle — only shown on selected bars */}
                        {onBarDrag && selected && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: EDGE_W,
                              cursor: 'ew-resize',
                              borderRadius: '0 5px 5px 0',
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {/* No-matches-in-view callout — rendered inside the scroll container */}
          {hasQuery && findState && findState.matchCount === 0 && rows.length > 0 && findState.filtersActive && (
            <div style={{
              padding: '12px 16px',
              fontSize: 12,
              color: 'var(--muted-foreground)',
              borderTop: '1px solid var(--border)',
            }}>
              No matches in current view.{' '}
              {onClearFilters && (
                <button
                  onClick={onClearFilters}
                  style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Drag tooltip — fixed position follows the mouse during bar drag */}
      {dragTooltip && (
        <div
          style={{
            position: 'fixed',
            left: dragTooltip.x + 14,
            top: dragTooltip.y - 28,
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {dragTooltip.text}
        </div>
      )}

      {/* "Why matched" tooltip — shown on hover for non-title match reasons */}
      {matchTooltip && (
        <div
          style={{
            position: 'fixed',
            left: matchTooltip.x + 12,
            top: matchTooltip.y - 36,
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            fontFamily: 'var(--font-sans)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {matchTooltip.reasons.map(r => (
            <div key={r} style={{ lineHeight: 1.6 }}>matched {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
