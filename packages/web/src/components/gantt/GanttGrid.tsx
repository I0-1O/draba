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
 */

import { useRef, useState, useCallback } from 'react';
import MemberAvatar from '../MemberAvatar';
import EmptyState from '../shared/EmptyState';
import type { Member } from '../../types';
import type { ColumnDef } from './granularity';
import { addDays } from './granularity';

const LABEL_COL_W = 240;
const HEADER_H = 36;
const ROW_H = 44;
const GROUP_H = 30;
const COL_W = 80;
const EDGE_W = 8; // px hit zone for resize handles

/** A positioned event bar ready for rendering. */
export interface GanttEvent {
  id: string;
  title: string;
  /** Fractional column start (0-based). */
  startCol: number;
  /** Fractional column span. */
  span: number;
  color: string;
  members: Member[];
  isChild: boolean;
}

export type GanttRow =
  | { kind: 'group'; id: string; label: string; color: string; count: number }
  | { kind: 'event'; event: GanttEvent };

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

interface Props {
  rows: GanttRow[];
  columns: ColumnDef[];
  /** Fractional column index of today (-1 if outside range). */
  todayIndex: number;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  /** Called when the user drags on an empty lane cell to create an event. */
  onLaneDrag?: (startDate: Date, endDate: Date, memberId: string | null) => void;
  /** Called when the user drags a bar edge or body to resize/move it. */
  onBarDrag?: (eventId: string, newStartDate: Date, newEndDate: Date) => void;
}

// ── Bar drag helpers ─────────────────────────────────────────────────────────

function tooltipText(zone: BarDragZone, startDate: Date, endDate: Date): string {
  if (zone === 'left') return `Start: ${formatDragDate(startDate)}`;
  if (zone === 'right') return `End: ${formatDragDate(endDate)}`;
  return `${formatDragDate(startDate)} → ${formatDragDate(endDate)}`;
}

// ── Date helpers ────────────────────────────────────────────────────────────

function colToStartDate(colIdx: number, columns: ColumnDef[]): Date {
  const i = Math.max(0, Math.min(columns.length - 1, colIdx));
  return columns[i].start;
}

// endColIdx is exclusive (the column *after* the last occupied one).
function colToEndDate(endColIdx: number, columns: ColumnDef[]): Date {
  const i = Math.max(1, Math.min(columns.length, endColIdx));
  return addDays(columns[i - 1].end, -1);
}

function formatDragDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GanttGrid({
  rows,
  columns,
  todayIndex,
  selectedEventId,
  onSelectEvent,
  onLaneDrag,
  onBarDrag,
}: Props) {
  const totalW = LABEL_COL_W + columns.length * COL_W;
  // Integer column index that contains today (for background highlight)
  const todayCol = todayIndex >= 0 ? Math.floor(todayIndex) : -1;

  // ── Drag-to-create state ──────────────────────────────────────────────────
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  // ── Bar drag state ────────────────────────────────────────────────────────
  const [barDrag, setBarDrag] = useState<BarDragState | null>(null);
  const barDragRef = useRef<BarDragState | null>(null);
  const [dragTooltip, setDragTooltip] = useState<TooltipState | null>(null);

  const colFromX = useCallback((laneX: number) => {
    return Math.max(0, Math.min(columns.length - 1, Math.floor(laneX / COL_W)));
  }, [columns.length]);

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
    ev: GanttEvent,
    zone: BarDragZone,
  ) => {
    if (!onBarDrag) return;
    e.preventDefault();
    e.stopPropagation(); // prevent lane-drag from firing

    // The bar's parent is the lane div (position: relative, flex: 1).
    const laneEl = e.currentTarget.parentElement;
    if (!laneEl) return;
    const laneRect = laneEl.getBoundingClientRect();

    const initStartCol = ev.startCol;
    const initEndCol = ev.startCol + ev.span;
    const initMouseX = e.clientX - laneRect.left;
    // Snap initial positions to integer columns for anchor math.
    const initSnapStart = Math.round(initStartCol);
    const initSnapEnd = Math.round(initEndCol);

    const state: BarDragState = {
      eventId: ev.id,
      zone,
      initStartCol,
      initEndCol,
      initMouseX,
      laneLeft: laneRect.left,
      snapStartCol: initSnapStart,
      snapEndCol: Math.max(initSnapEnd, initSnapStart + 1),
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

      let nextStart = s.snapStartCol;
      let nextEnd = s.snapEndCol;

      if (s.zone === 'left') {
        nextStart = Math.max(0, Math.min(Math.round(s.initStartCol + deltaCol), s.snapEndCol - 1));
      } else if (s.zone === 'right') {
        nextEnd = Math.max(s.snapStartCol + 1, Math.min(Math.round(s.initEndCol + deltaCol), n));
      } else {
        // body: preserve span, shift both
        const span = Math.max(1, Math.round(s.initEndCol - s.initStartCol));
        const shift = Math.round(deltaCol);
        nextStart = Math.max(0, Math.min(Math.round(s.initStartCol) + shift, n - span));
        nextEnd = nextStart + span;
      }

      const next: BarDragState = { ...s, snapStartCol: nextStart, snapEndCol: nextEnd };
      barDragRef.current = next;
      setBarDrag(next);

      const sd = colToStartDate(nextStart, columns);
      const ed = colToEndDate(nextEnd, columns);
      setDragTooltip({ text: tooltipText(s.zone, sd, ed), x: mv.clientX, y: mv.clientY });
    }

    function onMouseUp() {
      const s = barDragRef.current;
      if (s && onBarDrag) {
        const sd = colToStartDate(s.snapStartCol, columns);
        const ed = colToEndDate(s.snapEndCol, columns);
        onBarDrag(s.eventId, sd, ed);
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
          width: LABEL_COL_W,
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
        }}
      >
        Event
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

  // ── Empty state: header + centered placeholder ──────────────────────────────
  if (rows.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
          <div style={{ width: totalW, display: 'flex', height: HEADER_H, background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
            {headerContent}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState message="No viewable events" />
        </div>
      </div>
    );
  }

  // ── Unified scroll: header sticky inside the single container ──────────────
  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
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
                      width: LABEL_COL_W,
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
            const selected = selectedEventId === ev.id;
            const indent = ev.isChild ? 20 : 0;

            return (
              <div
                key={`${ev.id}-${rowIdx}`}
                style={{
                  display: 'flex',
                  height: ROW_H,
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                  background: selected ? 'hsl(188 59% 38% / .04)' : 'transparent',
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
                  onClick={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--muted)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selected ? 'var(--muted)' : 'var(--card)';
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: ev.color,
                      flexShrink: 0,
                    }}
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
                    const grabCursor = isDragging
                      ? 'grabbing'
                      : onBarDrag ? 'grab' : 'pointer';
                    return (
                      <div
                        onClick={() => {
                          // Bar click always selects — use the label cell to deselect.
                          if (!isDragging) onSelectEvent(ev.id);
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
                          boxShadow: selected
                            ? `0 0 0 2px white, 0 0 0 4px ${ev.color}`
                            : 'var(--shadow-sm)',
                          opacity: isDragging ? 0.85 : 1,
                          transition: isDragging ? 'none' : 'box-shadow 0.12s, opacity 0.1s',
                          fontFamily: 'var(--font-sans)',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { if (!isDragging) e.currentTarget.style.filter = 'brightness(1.08)'; }}
                        onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
                      >
                        {/* Left resize handle */}
                        {onBarDrag && (
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
                        {/* Right resize handle */}
                        {onBarDrag && (
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
    </div>
  );
}
