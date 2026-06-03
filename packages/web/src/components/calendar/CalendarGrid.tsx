/**
 * CalendarGrid — presentational grid for the Calendar view.
 *
 * Month (6-week) and Week (1-week) all-day-bar layouts.
 */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { CalendarLayout } from './CalendarToolbar';
import type { WeekRow, CalendarSegment } from '@/lib/calendarLanes';
import { overflowCountsForWeek, segmentsForDay, daysDiff } from '@/lib/calendarLanes';
import type { components } from '@draba/shared';
import type { Member } from '@/types';

type ApiActivity = components['schemas']['Activity'];

// ── Layout constants ──────────────────────────────────────────────────────────

const MONTH_DAY_HEADER_H = 28;
const WEEK_DAY_HEADER_H  = 60;
const BAR_H           = 20;
const LANE_SLOT_H     = 24;
const WEEK_BAR_H      = 66;   // 3-line bar for week view
const WEEK_LANE_SLOT_H = 70;  // WEEK_BAR_H + 4px gap
const OVERFLOW_H   = 20;   // reserved for "+N more" chips (month)
const EDGE_W       = 8;    // resize hit-zone on bar edges
const ROW_RESIZE_H = 6;    // month row-height drag strip
const COL_COUNT    = 7;

// ── Drag state ────────────────────────────────────────────────────────────────

type DragType = 'move' | 'resize-start' | 'resize-end';

interface DragState {
  activityId: string;
  type: DragType;
  originalStart: Date;
  originalEnd: Date;
  grabOffsetDays: number;
  currentStart: Date;
  currentEnd: Date;
}

/** Per-week position of the dragged bar during live drag. */
interface LiveSegment {
  startCol: number;
  endCol: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  color: string;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function utcMidnight(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z');
}

/**
 * Find the calendar day under the cursor.
 * Uses elementsFromPoint (plural) so the bar element (pointer-events: auto)
 * doesn't occlude the day cell's data-date attribute beneath it.
 */
function dayAtPoint(x: number, y: number): Date | null {
  const elements = document.elementsFromPoint(x, y);
  for (const el of elements) {
    const iso = (el as HTMLElement).dataset?.date;
    if (iso) return new Date(iso + 'T00:00:00Z');
  }
  return null;
}

function monthRowH(cap: number): number {
  return MONTH_DAY_HEADER_H + cap * LANE_SLOT_H + OVERFLOW_H + ROW_RESIZE_H;
}

// ── DayOverflowPopover ────────────────────────────────────────────────────────

function DayOverflowPopover({ segments, activityById, dayDate, anchorRect, onSelect, onClose }: {
  segments: CalendarSegment[];
  activityById: Map<string, ApiActivity>;
  dayDate: Date;
  anchorRect: DOMRect;
  onSelect: (act: ApiActivity) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [onClose]);
  const label = dayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return (
    <div ref={ref} style={{ position: 'fixed', top: anchorRect.bottom + 4, left: Math.min(anchorRect.left, window.innerWidth - 280), width: 260, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', zIndex: 200, overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{label}</div>
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {segments.map(seg => {
          const act = activityById.get(seg.activityId);
          if (!act) return null;
          return (
            <button key={seg.activityId} onClick={() => { onSelect(act); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 12px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: 'var(--foreground)', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CalendarBar ───────────────────────────────────────────────────────────────

interface BarProps {
  seg: CalendarSegment | LiveSegment & Pick<CalendarSegment, 'activityId' | 'lane' | 'title' | 'isMatch' | 'isActiveMatch' | 'assignedMemberIds' | 'statusName' | 'statusColor' | 'tags'>;
  topPx: number;
  barH: number;
  isSelected: boolean;
  hasQuery: boolean;
  isWeekLayout: boolean;
  memberById: Record<string, Member>;
  onPointerDown: (e: React.PointerEvent, activityId: string, type: DragType) => void;
  onClick: (activityId: string, e: React.MouseEvent) => void;
}

function CalendarBar({ seg, topPx, barH, isSelected, hasQuery, isWeekLayout, memberById, onPointerDown, onClick }: BarProps) {
  const isHighlighted = seg.isMatch || seg.isActiveMatch;
  const isDimmed = hasQuery && !isHighlighted;

  const assigneeNames = seg.assignedMemberIds
    .slice(0, 3)
    .map(id => memberById[id]?.name?.split(' ')[0])
    .filter((n): n is string => Boolean(n));

  const style: React.CSSProperties = {
    position: 'absolute',
    top: topPx + 2,
    left: `calc(${(seg.startCol / COL_COUNT) * 100}% + 2px)`,
    width: `calc(${((seg.endCol - seg.startCol + 1) / COL_COUNT) * 100}% - 4px)`,
    height: barH,
    background: seg.color,
    borderRadius: `${seg.continuesLeft ? 0 : 4}px ${seg.continuesRight ? 0 : 4}px ${seg.continuesRight ? 0 : 4}px ${seg.continuesLeft ? 0 : 4}px`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: isWeekLayout ? 'stretch' : 'center',
    overflow: 'hidden',
    opacity: isDimmed ? 0.3 : 1,
    outline: isSelected ? '2px solid var(--primary)' : seg.isActiveMatch ? '2px solid #f59e0b' : seg.isMatch ? '1px solid #f59e0b' : 'none',
    outlineOffset: 1,
    boxShadow: seg.isActiveMatch ? '0 0 0 3px rgba(245,158,11,0.3)' : 'none',
    userSelect: 'none',
    zIndex: isSelected ? 3 : 1,
    pointerEvents: 'auto',
  };

  const edgeStyle: React.CSSProperties = { position: 'absolute', top: 0, height: '100%', width: EDGE_W, cursor: 'ew-resize', zIndex: 2 };

  return (
    <div style={style}
      onClick={e => onClick(seg.activityId, e)}
      onPointerDown={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < EDGE_W && !seg.continuesLeft) {
          onPointerDown(e, seg.activityId, 'resize-start');
        } else if (x > rect.width - EDGE_W && !seg.continuesRight) {
          onPointerDown(e, seg.activityId, 'resize-end');
        } else {
          onPointerDown(e, seg.activityId, 'move');
        }
      }}
    >
      {!seg.continuesLeft  && <div style={{ ...edgeStyle, left: 0 }} />}
      {!seg.continuesRight && <div style={{ ...edgeStyle, right: 0, left: 'auto' }} />}

      {isWeekLayout ? (
        /* Week view: 3-line layout — title+assignees / status / tags */
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 6px', flex: 1, minWidth: 0, overflow: 'hidden', gap: 3, pointerEvents: 'none' }}>
          {/* Row 1: title + assignees */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
            {seg.continuesLeft && <span style={{ fontSize: 10, color: '#fff', flexShrink: 0 }}>◀</span>}
            <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>
              {seg.title}
            </span>
            {assigneeNames.length > 0 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {assigneeNames.join(', ')}
              </span>
            )}
            {seg.continuesRight && <span style={{ fontSize: 10, color: '#fff', flexShrink: 0 }}>▶</span>}
          </div>
          {/* Row 2: status chip */}
          <div style={{ overflow: 'hidden', lineHeight: '14px' }}>
            {seg.statusName ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 500,
                background: seg.statusColor ? `color-mix(in srgb, ${seg.statusColor} 25%, rgba(255,255,255,0.15))` : 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: `1px solid ${seg.statusColor ? `color-mix(in srgb, ${seg.statusColor} 50%, rgba(255,255,255,0.2))` : 'rgba(255,255,255,0.25)'}`,
                whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: seg.statusColor ?? 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{seg.statusName}</span>
              </span>
            ) : null}
          </div>
          {/* Row 3: tag chips */}
          <div style={{ display: 'flex', gap: 3, overflow: 'hidden', lineHeight: '14px' }}>
            {(seg.tags ?? []).slice(0, 3).map((t, i) => (
              <span key={i} style={{
                display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: 10,
                background: t.color ? `color-mix(in srgb, ${t.color} 25%, rgba(255,255,255,0.15))` : 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: `1px solid ${t.color ? `color-mix(in srgb, ${t.color} 50%, rgba(255,255,255,0.2))` : 'rgba(255,255,255,0.25)'}`,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Month view: single-line layout */
        <>
          {seg.continuesLeft && <span style={{ fontSize: 10, color: '#fff', paddingLeft: 2, pointerEvents: 'none', flexShrink: 0 }}>◀</span>}
          <span style={{ fontSize: 11, fontWeight: 500, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '0 4px', pointerEvents: 'none', flex: 1, minWidth: 0 }}>
            {seg.title}
          </span>
          {assigneeNames.length > 0 && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)', paddingRight: 4, whiteSpace: 'nowrap', pointerEvents: 'none', flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {assigneeNames.join(', ')}
            </span>
          )}
          {seg.continuesRight && <span style={{ fontSize: 10, color: '#fff', paddingRight: 2, pointerEvents: 'none', flexShrink: 0 }}>▶</span>}
        </>
      )}
    </div>
  );
}

// ── Month row-height resize handle ────────────────────────────────────────────

function RowResizeHandle({ weekStart, currentCap, laneCount, onCapDraft, onCapCommit }: {
  weekStart: Date;
  currentCap: number;
  laneCount: number;
  onCapDraft: (weekStart: Date, newCap: number) => void;
  onCapCommit: (weekStart: Date, newCap: number) => void;
}) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startCap = useRef(0);
  const lastCap = useRef(currentCap);

  return (
    <div
      onPointerDown={e => {
        e.preventDefault(); e.stopPropagation();
        isDragging.current = true;
        startY.current = e.clientY;
        startCap.current = currentCap;
        lastCap.current = currentCap;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (!isDragging.current) return;
        const dy = e.clientY - startY.current;
        const newCap = Math.max(1, Math.min(laneCount || 6, startCap.current + Math.floor(dy / LANE_SLOT_H)));
        if (newCap !== lastCap.current) { lastCap.current = newCap; onCapDraft(weekStart, newCap); }
      }}
      onPointerUp={e => {
        if (isDragging.current) onCapCommit(weekStart, lastCap.current);
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      style={{ height: ROW_RESIZE_H, cursor: 'ns-resize', background: 'transparent', borderTop: '1px solid var(--border)', transition: 'background 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--muted)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      title="Drag to show more or fewer activities"
    />
  );
}

// ── WeekRowRenderer ───────────────────────────────────────────────────────────

const DOW_LABELS_MON = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_LABELS_SUN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function WeekRowRenderer({
  row,
  isFirst,
  layout,
  weekStartDay,
  activityById,
  memberById,
  selectedActivityId,
  hasQuery,
  today,
  /** The dragged bar's live position in this week row (or null if not overlapping). */
  liveSeg,
  /** Activity ID being dragged — to suppress the original static segment. */
  dragActivityId,
  onBarPointerDown,
  onBarClick,
  onCellClick,
  onCapDraft,
  onCapCommit,
}: {
  row: WeekRow;
  isFirst: boolean;
  layout: CalendarLayout;
  weekStartDay: 0 | 1;
  activityById: Map<string, ApiActivity>;
  memberById: Record<string, Member>;
  selectedActivityId: string | null;
  hasQuery: boolean;
  today: Date;
  liveSeg: LiveSegment | null;
  dragActivityId: string | null;
  onBarPointerDown: (e: React.PointerEvent, activityId: string, type: DragType) => void;
  onBarClick: (activityId: string, e: React.MouseEvent) => void;
  onCellClick: (date: Date) => void;
  onCapDraft: (weekStart: Date, newCap: number) => void;
  onCapCommit: (weekStart: Date, newCap: number) => void;
}) {
  const [popover, setPopover] = useState<{ col: number; rect: DOMRect } | null>(null);
  const overflows = useMemo(() => overflowCountsForWeek(row), [row]);
  const dowLabels = weekStartDay === 0 ? DOW_LABELS_SUN : DOW_LABELS_MON;
  const todayISO = today.toISOString().slice(0, 10);
  const isWeek = layout === 'week';
  const dayHeaderH  = isWeek ? WEEK_DAY_HEADER_H : MONTH_DAY_HEADER_H;
  const barH        = isWeek ? WEEK_BAR_H      : BAR_H;
  const laneSlotH   = isWeek ? WEEK_LANE_SLOT_H : LANE_SLOT_H;

  // Month: cap-filtered. Week: all segments. Either way, suppress the dragged bar's
  // static position so only the live overlay renders.
  const staticSegments = (isWeek ? row.segments : row.segments.filter(s => s.lane < row.visibleLaneCap))
    .filter(s => s.activityId !== dragActivityId);

  // Week: min-height ensures all lanes are visible even if flex container is small.
  const weekMinH = WEEK_DAY_HEADER_H + row.laneCount * WEEK_LANE_SLOT_H + 40;

  const rowStyle: React.CSSProperties = isWeek
    ? { position: 'relative', flex: 1, minHeight: weekMinH, borderBottom: '1px solid var(--border)' }
    : { position: 'relative', height: monthRowH(row.visibleLaneCap), borderBottom: '1px solid var(--border)' };

  return (
    <div style={rowStyle}>
      {/* Day cells — borders, date headers, click zones */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: isWeek ? 0 : ROW_RESIZE_H, display: 'grid', gridTemplateColumns: `repeat(${COL_COUNT}, 1fr)` }}>
        {row.days.map((day, col) => {
          const dayISO = day.toISOString().slice(0, 10);
          const isToday = dayISO === todayISO;
          const overflowCount = isWeek ? 0 : overflows[col];
          return (
            <div key={col} data-date={dayISO}
              style={{ borderRight: col < COL_COUNT - 1 ? '1px solid var(--border)' : 'none', background: isToday ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'transparent', position: 'relative', cursor: 'default' }}
              onClick={e => { if ((e.target as HTMLElement).closest('[data-bar]')) return; onCellClick(day); }}
            >
              {isWeek ? (
                /* Week view: prominent centered header */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: WEEK_DAY_HEADER_H, gap: 2, borderBottom: '1px solid var(--border)', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {dowLabels[col]}
                  </span>
                  <span style={{ fontSize: 22, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--primary)' : 'var(--foreground)', lineHeight: 1 }}>
                    {day.getUTCDate()}
                  </span>
                </div>
              ) : (
                <>
                  {isFirst && (
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)', textAlign: 'center', paddingTop: 4, pointerEvents: 'none' }}>
                      {dowLabels[col]}
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: isFirst ? 13 : 6, right: 6, fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--primary)' : 'var(--muted-foreground)', lineHeight: 1, pointerEvents: 'none' }}>
                    {day.getUTCDate()}
                  </div>
                  {overflowCount > 0 && (
                    <button style={{ position: 'absolute', bottom: OVERFLOW_H / 2 - 8, left: 2, right: 2, height: 16, fontSize: 10, color: 'var(--muted-foreground)', background: 'var(--muted)', border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0 }}
                      onClick={e => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setPopover(p => p?.col === col ? null : { col, rect }); }}
                    >
                      +{overflowCount} more
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Static activity bars (the dragged bar is suppressed here) */}
      {staticSegments.map(seg => {
        const act = activityById.get(seg.activityId);
        if (!act) return null;
        return (
          <div key={seg.activityId} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}>
              <CalendarBar
                seg={seg}
                topPx={dayHeaderH + seg.lane * laneSlotH}
                barH={barH}
                isSelected={selectedActivityId === seg.activityId}
                hasQuery={hasQuery}
                isWeekLayout={isWeek}
                memberById={memberById}
                onPointerDown={onBarPointerDown}
                onClick={onBarClick}
              />
            </div>
          </div>
        );
      })}

      {/* Live drag overlay: the dragged bar at its current position */}
      {liveSeg && dragActivityId && (() => {
        const origSeg = row.segments.find(s => s.activityId === dragActivityId) ?? row.segments[0];
        const displaySeg: CalendarSegment = {
          activityId: dragActivityId,
          startCol: liveSeg.startCol,
          endCol: liveSeg.endCol,
          lane: origSeg?.lane ?? 0,
          continuesLeft: liveSeg.continuesLeft,
          continuesRight: liveSeg.continuesRight,
          color: liveSeg.color,
          title: activityById.get(dragActivityId)?.title ?? '',
          icon: activityById.get(dragActivityId)?.icon ?? undefined,
          assignedMemberIds: activityById.get(dragActivityId)?.assignedMemberIds ?? [],
          isMatch: false,
          isActiveMatch: false,
        };
        return (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <div style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}>
              <CalendarBar
                seg={displaySeg}
                topPx={dayHeaderH + displaySeg.lane * laneSlotH}
                barH={barH}
                isSelected={selectedActivityId === dragActivityId}
                hasQuery={false}
                isWeekLayout={isWeek}
                memberById={memberById}
                onPointerDown={onBarPointerDown}
                onClick={onBarClick}
              />
            </div>
          </div>
        );
      })()}

      {/* Month resize handle */}
      {!isWeek && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <RowResizeHandle weekStart={row.weekStart} currentCap={row.visibleLaneCap} laneCount={row.laneCount} onCapDraft={onCapDraft} onCapCommit={onCapCommit} />
        </div>
      )}

      {/* Overflow popover */}
      {popover && (
        <DayOverflowPopover
          segments={segmentsForDay(row, popover.col)}
          activityById={activityById}
          dayDate={row.days[popover.col]}
          anchorRect={popover.rect}
          onSelect={act => { onBarClick(act.id, new MouseEvent('click') as unknown as React.MouseEvent); }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

// ── CalendarGrid ──────────────────────────────────────────────────────────────

export interface CalendarGridProps {
  weeks: WeekRow[];
  layout: CalendarLayout;
  weekStartDay: 0 | 1;
  activityById: Map<string, ApiActivity>;
  memberById: Record<string, Member>;
  selectedActivityId: string | null;
  hasQuery: boolean;
  today: Date;
  onSelectActivity: (act: ApiActivity | null) => void;
  onCellClick: (date: Date) => void;
  onBarDragProgress: (activityId: string, newStart: Date, newEnd: Date) => void;
  onBarDragEnd: () => void;
  onBarDragCommit: (activityId: string, newStart: Date, newEnd: Date) => void;
  onCapDraft: (weekStart: Date, newCap: number) => void;
  onCapCommit: (weekStart: Date, newCap: number) => void;
}

export default function CalendarGrid({
  weeks,
  layout,
  weekStartDay,
  activityById,
  memberById,
  selectedActivityId,
  hasQuery,
  today,
  onSelectActivity,
  onCellClick,
  onBarDragProgress,
  onBarDragEnd,
  onBarDragCommit,
  onCapDraft,
  onCapCommit,
}: CalendarGridProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Ref for the latest drag position — prevents stale closure in the useEffect.
  const liveDragRef = useRef<{ start: Date; end: Date } | null>(null);

  // Refs for callbacks so the useEffect never captures stale props.
  const onBarDragProgressRef = useRef(onBarDragProgress);
  const onBarDragEndRef      = useRef(onBarDragEnd);
  const onBarDragCommitRef   = useRef(onBarDragCommit);
  const onSelectActivityRef  = useRef(onSelectActivity);
  const activityByIdRef      = useRef(activityById);
  useEffect(() => { onBarDragProgressRef.current = onBarDragProgress; }, [onBarDragProgress]);
  useEffect(() => { onBarDragEndRef.current      = onBarDragEnd; },      [onBarDragEnd]);
  useEffect(() => { onBarDragCommitRef.current   = onBarDragCommit; },   [onBarDragCommit]);
  useEffect(() => { onSelectActivityRef.current  = onSelectActivity; },  [onSelectActivity]);
  useEffect(() => { activityByIdRef.current      = activityById; },      [activityById]);

  // ── Drag ────────────────────────────────────────────────────────────────────

  const handleBarPointerDown = useCallback((
    e: React.PointerEvent,
    activityId: string,
    type: DragType,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const act = activityById.get(activityId);
    if (!act) return;
    const originalStart = utcMidnight(act.startAt);
    const originalEnd   = utcMidnight(act.endAt);

    // Use elementsFromPoint to find the day cell beneath the bar.
    const clickedDay = dayAtPoint(e.clientX, e.clientY);
    const grabOffsetDays = clickedDay ? daysDiff(originalStart, clickedDay) : 0;

    liveDragRef.current = { start: originalStart, end: originalEnd };
    setDragState({ activityId, type, originalStart, originalEnd, grabOffsetDays, currentStart: originalStart, currentEnd: originalEnd });
  }, [activityById]);

  useEffect(() => {
    if (!dragState) return;
    const ds = dragState;
    const originalSpan = daysDiff(ds.originalStart, ds.originalEnd);

    function onPointerMove(e: PointerEvent) {
      const targetDay = dayAtPoint(e.clientX, e.clientY);
      if (!targetDay) return;

      let newStart: Date;
      let newEnd: Date;

      if (ds.type === 'move') {
        newStart = new Date(targetDay);
        newStart.setUTCDate(targetDay.getUTCDate() - ds.grabOffsetDays);
        newEnd = new Date(newStart);
        newEnd.setUTCDate(newStart.getUTCDate() + originalSpan);
      } else if (ds.type === 'resize-start') {
        newStart = targetDay < ds.originalEnd ? targetDay : ds.originalEnd;
        newEnd   = ds.originalEnd;
      } else {
        newStart = ds.originalStart;
        newEnd   = targetDay > ds.originalStart ? targetDay : ds.originalStart;
      }

      liveDragRef.current = { start: newStart, end: newEnd };
      setDragState(prev => prev ? { ...prev, currentStart: newStart, currentEnd: newEnd } : null);
      onBarDragProgressRef.current(ds.activityId, newStart, newEnd);
    }

    function onPointerUp() {
      const live = liveDragRef.current;
      liveDragRef.current = null;
      if (live) {
        const changed =
          live.start.getTime() !== ds.originalStart.getTime() ||
          live.end.getTime()   !== ds.originalEnd.getTime();
        if (changed) {
          onBarDragCommitRef.current(ds.activityId, live.start, live.end);
        } else {
          // No movement — treat as a click. The DOM click event is unreliable
          // here because pointerdown removes the bar from staticSegments and
          // re-adds it after pointerup, so the click event fires on a
          // different DOM node. Drive selection from the pointer lifecycle.
          onSelectActivityRef.current(activityByIdRef.current.get(ds.activityId) ?? null);
        }
      }
      onBarDragEndRef.current();
      setDragState(null);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState?.activityId, dragState?.type]);

  // ── Live drag overlay across all weeks ──────────────────────────────────────

  // Compute where the dragged bar currently sits in EVERY week row.
  // This drives real-time rendering across week boundaries, even in weeks
  // that didn't originally contain the bar.
  const liveSegs: (LiveSegment | null)[] = useMemo(() => {
    if (!dragState) return weeks.map(() => null);
    const { activityId, currentStart, currentEnd } = dragState;

    // Find the bar's color from any original segment.
    let color = '#6b7280';
    for (const row of weeks) {
      const s = row.segments.find(s => s.activityId === activityId);
      if (s) { color = s.color; break; }
    }

    return weeks.map(row => {
      const weekEnd = row.days[6];
      if (currentEnd < row.weekStart || currentStart > weekEnd) return null;
      const rawStart = daysDiff(row.weekStart, currentStart);
      const rawEnd   = daysDiff(row.weekStart, currentEnd);
      return {
        startCol: Math.max(0, rawStart),
        endCol:   Math.min(6, rawEnd),
        continuesLeft:  rawStart < 0,
        continuesRight: rawEnd > 6,
        color,
      };
    });
  }, [dragState, weeks]);

  const handleBarClick = useCallback((activityId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectActivity(activityById.get(activityId) ?? null);
  }, [activityById, onSelectActivity]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const isWeek = layout === 'week';

  const outerStyle: React.CSSProperties = isWeek
    ? { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--background)' }
    : { flex: 1, overflow: 'auto', background: 'var(--background)' };

  const innerStyle: React.CSSProperties = isWeek
    ? { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 420, cursor: dragState ? 'grabbing' : undefined }
    : { minWidth: 420, cursor: dragState ? 'grabbing' : undefined };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {weeks.map((row, wi) => (
          <WeekRowRenderer
            key={row.weekStart.toISOString()}
            row={row}
            isFirst={wi === 0}
            layout={layout}
            weekStartDay={weekStartDay}
            activityById={activityById}
            memberById={memberById}
            selectedActivityId={selectedActivityId}
            hasQuery={hasQuery}
            today={today}
            liveSeg={liveSegs[wi]}
            dragActivityId={dragState?.activityId ?? null}
            onBarPointerDown={handleBarPointerDown}
            onBarClick={handleBarClick}
            onCellClick={onCellClick}
            onCapDraft={onCapDraft}
            onCapCommit={onCapCommit}
          />
        ))}
      </div>
    </div>
  );
}
