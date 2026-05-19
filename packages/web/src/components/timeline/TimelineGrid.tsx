/**
 * TimelineGrid — presentational Gantt chart.
 *
 * Renders a sticky header row of day labels, then one row per GanttRow entry.
 * Rows are either group-header dividers or event bars. All data preparation
 * (grouping, sorting, date math) lives in the parent TimelineView.
 */

import MemberAvatar from '../MemberAvatar';
import type { Member } from '../../types';

// Left column width — enough for title + avatar cluster.
const LABEL_COL_W = 240;
// Heights
const HEADER_H = 36;
const ROW_H = 44;
const GROUP_H = 30;

/** A positioned event bar ready for rendering. */
export interface GanttEvent {
  id: string;
  title: string;
  startCol: number;
  span: number;
  color: string;
  /** All assigned members — shown as a stacked avatar cluster in the label cell. */
  members: Member[];
  /** True when this event is a child of another (adds left indent in parent grouping). */
  isChild: boolean;
}

/** Either a collapsible section header or a single event row. */
export type GanttRow =
  | { kind: 'group'; id: string; label: string; color: string; count: number }
  | { kind: 'event'; event: GanttEvent };

interface Props {
  rows: GanttRow[];
  /** Display label for each day column, e.g. ["May 18", "May 19", …] */
  days: string[];
  /** Index within `days` that is today — drives the highlight and today line. */
  todayIndex: number;
  /** Pixel width of each day column. Driven by the zoom control. */
  colWidth: number;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}

export default function TimelineGrid({
  rows,
  days,
  todayIndex,
  colWidth,
  selectedEventId,
  onSelectEvent,
}: Props) {
  const totalW = LABEL_COL_W + days.length * colWidth;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
        <div
          style={{
            width: totalW,
            display: 'flex',
            height: HEADER_H,
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}
        >
          {/* "Event" label over the sticky left column */}
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
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Event
          </div>

          {/* Day columns */}
          {days.map((label, i) => (
            <div
              key={i}
              style={{
                width: colWidth,
                flexShrink: 0,
                height: HEADER_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: i === todayIndex ? 700 : 600,
                color: i === todayIndex ? 'var(--primary)' : 'var(--muted-foreground)',
                borderRight: i < days.length - 1 ? '1px solid var(--border)' : 'none',
                position: 'relative',
              }}
            >
              {label}
              {i === todayIndex && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--secondary)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{ width: totalW }}>

          {rows.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 120,
                color: 'var(--muted-foreground)',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
              }}
            >
              No events in this date range.
            </div>
          )}

          {rows.map((row, rowIdx) => {
            // ── Group header ──────────────────────────────────────────
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
                  {/* Extend group header across the grid */}
                  <div style={{ flex: 1 }} />
                </div>
              );
            }

            // ── Event row ─────────────────────────────────────────────
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
                    background: selected ? 'hsl(188 59% 38% / .06)' : 'var(--card)',
                    zIndex: 3,
                    borderRight: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onClick={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                  onMouseEnter={e => {
                    if (!selected) e.currentTarget.style.background = 'var(--muted)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selected
                      ? 'hsl(188 59% 38% / .06)'
                      : 'var(--card)';
                  }}
                >
                  {/* Color dot */}
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: ev.color,
                      flexShrink: 0,
                    }}
                  />
                  {/* Title */}
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
                  {/* Member avatar cluster (max 3) */}
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
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  {/* Background day columns */}
                  {days.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: colWidth,
                        height: '100%',
                        flexShrink: 0,
                        borderRight: i < days.length - 1 ? '1px solid var(--border)' : 'none',
                        background:
                          i === todayIndex ? 'hsl(188 59% 38% / .04)' : 'transparent',
                      }}
                    />
                  ))}

                  {/* Today vertical line */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: todayIndex * colWidth + colWidth / 2,
                      width: 2,
                      background: 'var(--secondary)',
                      opacity: 0.5,
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Event bar */}
                  <div
                    onClick={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                    style={{
                      position: 'absolute',
                      top: 9,
                      bottom: 9,
                      left: ev.startCol * colWidth + 2,
                      width: Math.max(ev.span * colWidth - 4, colWidth * 0.5),
                      background: ev.color,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'white',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer',
                      zIndex: 4,
                      boxShadow: selected
                        ? `0 0 0 2px white, 0 0 0 4px ${ev.color}`
                        : 'var(--shadow-sm)',
                      transition: 'box-shadow 0.12s',
                      fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = '')}
                  >
                    {ev.title}
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}
