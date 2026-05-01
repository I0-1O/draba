import { UserPlus } from 'lucide-react';
import MemberAvatar from '../MemberAvatar';
import type { DrabaEvent, Member } from '../../types';

// Layout constants. Event blocks are absolutely positioned inside each
// member's lane using these — left = startCol * COL_W, width = span * COL_W.
// Keep these in sync with the DESIGN_SYSTEM doc.
const COL_W = 80;        // px per day column
const ROW_H = 52;        // px per member row
const PERSON_COL_W = 140; // px for the sticky member name column

interface Props {
  members: Member[];
  events: DrabaEvent[];
  /** Display label for each day column, e.g. ["Apr 28", "Apr 29", …] */
  days: string[];
  /** Index within `days` that is today — drives the highlight column and today line */
  todayIndex: number;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
}

/**
 * The core "Person × Time" view. Renders a sticky header row of day labels,
 * then one row per member. Each row contains a sticky name cell on the left
 * and a lane on the right with absolutely-positioned event blocks.
 *
 * The component is presentational — date arithmetic, event positioning
 * (`startCol`, `span`), and selection state are all owned by the parent.
 */
export default function TimelineGrid({
  members,
  events,
  days,
  todayIndex,
  selectedEventId,
  onSelectEvent,
}: Props) {
  const totalW = PERSON_COL_W + days.length * COL_W;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sticky header row */}
      <div style={{ overflowX: 'auto', overflowY: 'hidden', flexShrink: 0 }}>
        <div
          style={{
            width: totalW,
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: PERSON_COL_W,
              flexShrink: 0,
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              borderRight: '1px solid var(--border)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--muted-foreground)',
              height: 36,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Member
          </div>

          {days.map((label, i) => (
            <div
              key={i}
              style={{
                width: COL_W,
                flexShrink: 0,
                height: 36,
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

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ width: totalW }}>
          {members.map(member => {
            const memberEvents = events.filter(e => e.memberId === member.id);
            return (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  height: ROW_H,
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                }}
              >
                {/* Sticky member name cell */}
                <div
                  style={{
                    width: PERSON_COL_W,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 16px',
                    borderRight: '1px solid var(--border)',
                    background: 'var(--card)',
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  <MemberAvatar member={member} size={26} />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {member.name.split(' ')[0]}
                  </span>
                </div>

                {/* Lane */}
                <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                  {/* Background columns */}
                  {days.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: COL_W,
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
                      left: todayIndex * COL_W + COL_W / 2,
                      width: 2,
                      background: 'var(--secondary)',
                      opacity: 0.6,
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Event blocks */}
                  {memberEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => onSelectEvent(ev.id === selectedEventId ? null : ev.id)}
                      style={{
                        position: 'absolute',
                        top: 8,
                        bottom: 8,
                        left: ev.startCol * COL_W + 3,
                        width: ev.span * COL_W - 6,
                        background: ev.color,
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 9px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'white',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        zIndex: 4,
                        boxShadow:
                          selectedEventId === ev.id
                            ? `0 0 0 2px white, 0 0 0 4px ${ev.color}`
                            : 'var(--shadow-sm)',
                        opacity: ev.status === 'done' ? 0.65 : 1,
                        transition: 'box-shadow 0.12s, opacity 0.12s',
                        fontFamily: 'var(--font-sans)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                      onMouseLeave={e => (e.currentTarget.style.filter = '')}
                    >
                      {ev.status === 'done' && '✓ '}
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Add member hint row */}
          <div style={{ display: 'flex', height: ROW_H, opacity: 0.4 }}>
            <div
              style={{
                width: PERSON_COL_W,
                flexShrink: 0,
                borderRight: '1px solid var(--border)',
                background: 'var(--card)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 6,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={14} strokeWidth={1.8} color="var(--muted-foreground)" />
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Add member</span>
            </div>
            <div style={{ flex: 1, borderBottom: '1px solid var(--border)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
