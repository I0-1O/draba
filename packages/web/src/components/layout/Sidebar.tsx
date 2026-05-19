import { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Settings2,
  Code2,
  Palette,
  BarChart3,
  Upload,
  CalendarPlus,
  LineChart,
  Megaphone,
  Plug,
} from 'lucide-react';

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onActiveColorChange?: (color: string) => void;
}

const ICON = { width: 15, height: 15, strokeWidth: 1.8 } as const;
const ICON_SM = { width: 13, height: 13, strokeWidth: 1.8 } as const;
const ICON_XS = { width: 11, height: 11, strokeWidth: 2 } as const;

interface Timeline {
  id: string;
  name: string;
  color: string;
  icon: React.ReactNode;
}

interface Member {
  id: string;
  name: string;
  initials: string;
  color: string;
}

const DEMO_TIMELINES: Timeline[] = [
  { id: '1', name: 'Q1 2027 Roadmap',            color: '#1A97A2', icon: <Code2 {...ICON_SM} /> },
  { id: '2', name: 'New Logo GTM',                color: '#6366F1', icon: <Palette {...ICON_SM} /> },
  { id: '3', name: 'Q4 2026 Roadmap',             color: '#F17B2B', icon: <BarChart3 {...ICON_SM} /> },
  { id: '4', name: 'Project Pinky and the Brain', color: '#E11D48', icon: <Megaphone {...ICON_SM} /> },
];

const DEMO_ARCHIVED: Timeline[] = [
  { id: 'a1', name: 'Q1 Roadmap',      color: '#64748B', icon: <LineChart {...ICON_SM} /> },
  { id: 'a2', name: 'Product Launch',  color: '#64748B', icon: <Megaphone {...ICON_SM} /> },
];

const DEMO_MEMBERS: Member[] = [
  { id: '1', name: 'Lindsay K.', initials: 'LK', color: '#1A97A2' },
  { id: '2', name: 'John Doe',   initials: 'JD', color: '#6366F1' },
  { id: '3', name: 'Sarah M.',   initials: 'SM', color: '#F17B2B' },
];

interface TimelineItemProps {
  timeline: Timeline;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  onSettings: () => void;
}

function TimelineItem({ timeline, active, collapsed, onClick, onSettings }: TimelineItemProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: active
          ? 'rgba(255,255,255,0.10)'
          : hovered
          ? 'rgba(255,255,255,0.05)'
          : 'transparent',
        borderLeft: active ? `2px solid ${timeline.color}` : '2px solid transparent',
        transition: 'background 0.12s',
        cursor: 'pointer',
        minHeight: 34,
      }}
    >
      <button
        onClick={onClick}
        title={collapsed ? timeline.name : undefined}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: collapsed ? '7px 14px' : '7px 8px 7px 16px',
          background: 'none',
          border: 'none',
          color: active ? 'white' : 'rgba(255,255,255,0.65)',
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          textAlign: 'left',
          minWidth: 0,
        }}
      >
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: timeline.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}
        >
          {timeline.icon}
        </span>
        {!collapsed && (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {timeline.name}
          </span>
        )}
      </button>

      {!collapsed && (
        <button
          onClick={e => { e.stopPropagation(); onSettings(); }}
          title={`Configure ${timeline.name}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            marginRight: 6,
            background: 'none',
            border: 'none',
            borderRadius: 5,
            color: 'rgba(255,255,255,0.4)',
            cursor: 'pointer',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.12s',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <Settings2 {...ICON_SM} />
        </button>
      )}
    </div>
  );
}

function ConnectorItem({ name, status, color }: { name: string; status: string; color: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 6px 6px 16px',
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 0.12s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 4,
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
          <rect x="1" y="1" width="9" height="18" rx="1.5" />
          <rect x="14" y="1" width="9" height="12" rx="1.5" />
        </svg>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
          {status}
        </div>
      </div>
      <button
        title={`Configure ${name}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, marginRight: 0,
          background: 'none', border: 'none', borderRadius: 5,
          color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
          opacity: hovered ? 1 : 0, transition: 'opacity 0.12s',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
      >
        <Settings2 {...ICON_SM} />
      </button>
    </div>
  );
}

/**
 * Left navigation rail: brand, team selector with members, and timeline list.
 * Collapsed/expanded state is driven by the parent.
 */
export default function Sidebar({ collapsed, onToggle, onActiveColorChange }: Props) {
  const [activeId, setActiveId] = useState(DEMO_TIMELINES[0].id);
  const [teamOpen, setTeamOpen] = useState(true);
  const [eventOpen, setEventOpen] = useState(true);
  const [connectorsOpen, setConnectorsOpen] = useState(true);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [timelinesOpen, setTimelinesOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [teamHovered, setTeamHovered] = useState(false);

  const activeTimeline = DEMO_TIMELINES.find(t => t.id === activeId)!;

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_MIN);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(SIDEBAR_MIN);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW.current + delta)));
    }
    function onMouseUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }

  return (
    <div
      style={{
        position: 'relative',
        width: collapsed ? 52 : sidebarWidth,
        flexShrink: 0,
        background: 'var(--color-charcoal)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.0s',
        overflow: 'hidden',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? '0 13px' : '0 8px 0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          height: 'var(--topbar-h)',
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <div
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
          >
            <img src="/logo.svg" alt="Draba" style={{ width: 28, height: 28 }} />
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
              draba
            </span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            borderRadius: 6,
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight {...ICON} /> : <ChevronLeft {...ICON} />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Collapsed: team + timeline icons only */}
        {collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
            {/* Team avatar — click to expand */}
            <div
              title="Product Marketing"
              onClick={onToggle}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                cursor: 'pointer',
              }}
            >
              P
            </div>
            {/* Active timeline — click to expand */}
            <div
              title={activeTimeline.name}
              onClick={onToggle}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: activeTimeline.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              {activeTimeline.icon}
            </div>

            {/* New event */}
            <button
              title="New event"
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.14)'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
              }}
            >
              <CalendarPlus width={15} height={15} strokeWidth={1.8} />
            </button>
          </div>
        )}

        {/* Team section */}
        {!collapsed && (
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Section header — collapsible, same pattern as TIMELINE */}
            <button
              onClick={() => setTeamOpen(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 12px 6px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Team
              </span>
              {teamOpen
                ? <ChevronDown width={12} height={12} strokeWidth={2} />
                : <ChevronRight width={12} height={12} strokeWidth={2} />}
            </button>

            {/* Team row — always visible when section is open or closed */}
            <div
              onMouseEnter={() => setTeamHovered(true)}
              onMouseLeave={() => setTeamHovered(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 6px 5px 16px',
                borderLeft: '2px solid transparent',
                cursor: 'pointer',
                minHeight: 34,
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: 'white',
                flexShrink: 0,
              }}>
                P
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'white', flex: 1, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                Product Marketing
              </span>
              <button
                title="Team settings"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  marginRight: 6,
                  background: 'none',
                  border: 'none',
                  borderRadius: 5,
                  color: 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  opacity: teamHovered ? 1 : 0,
                  transition: 'opacity 0.12s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                <Settings2 {...ICON_SM} />
              </button>
            </div>

            {/* Members — only when team section is expanded */}
            {teamOpen && (
              <>
                <button
                  onClick={() => setMembersOpen(o => !o)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    width: '100%',
                    padding: '6px 8px 4px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {membersOpen
                    ? <ChevronDown {...ICON_XS} />
                    : <ChevronRight {...ICON_XS} />}
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Members
                  </span>
                </button>

                {membersOpen && (
                  <div style={{ paddingBottom: 8 }}>
                    {DEMO_MEMBERS.map(m => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 16px',
                          borderRadius: 0,
                          cursor: 'default',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: m.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'white',
                          flexShrink: 0,
                        }}>
                          {m.initials}
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Timelines section */}
        <div style={{ padding: '8px 0' }}>
          {!collapsed ? (
            <button
              onClick={() => setTimelinesOpen(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '6px 12px 4px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Timeline
              </span>
              {timelinesOpen
                ? <ChevronDown width={12} height={12} strokeWidth={2} />
                : <ChevronRight width={12} height={12} strokeWidth={2} />}
            </button>
          ) : (
            <div style={{ height: 8 }} />
          )}

          {!collapsed && (timelinesOpen ? (
            <>
              {DEMO_TIMELINES.map(tl => (
                <TimelineItem
                  key={tl.id}
                  timeline={tl}
                  active={activeId === tl.id}
                  collapsed={false}
                  onClick={() => { setActiveId(tl.id); onActiveColorChange?.(tl.color); }}
                  onSettings={() => {}}
                />
              ))}
              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 12,
                  cursor: 'pointer',
                  width: '100%',
                  fontFamily: 'var(--font-sans)',
                  marginTop: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                <Plus {...ICON_SM} />
                New timeline
              </button>

              {/* Archived sub-section */}
              <button
                onClick={() => setArchivedOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  width: '100%', padding: '6px 12px 4px 16px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sans)',
                  marginTop: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
              >
                {archivedOpen
                  ? <ChevronDown {...ICON_XS} />
                  : <ChevronRight {...ICON_XS} />}
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Archived
                </span>
                <span style={{ fontSize: 10, marginLeft: 4 }}>({DEMO_ARCHIVED.length})</span>
              </button>

              {archivedOpen && (
                <div style={{ opacity: 0.5 }}>
                  {DEMO_ARCHIVED.map(tl => (
                    <TimelineItem
                      key={tl.id}
                      timeline={tl}
                      active={false}
                      collapsed={false}
                      onClick={() => {}}
                      onSettings={() => {}}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Section collapsed: show just the active timeline */
            <TimelineItem
              timeline={activeTimeline}
              active={true}
              collapsed={false}
              onClick={() => setTimelinesOpen(true)}
              onSettings={() => {}}
            />
          ))}
        </div>
        {/* Event section */}
        {!collapsed && (
          <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Header with collapse toggle + quick-add icon */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 6px 4px 16px' }}>
              <button
                onClick={() => setEventOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flex: 1,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sans)',
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Event
                </span>
                {eventOpen
                  ? <ChevronDown width={12} height={12} strokeWidth={2} />
                  : <ChevronRight width={12} height={12} strokeWidth={2} />}
              </button>
              <button
                title="New event"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: 5,
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
              >
                <CalendarPlus width={14} height={14} strokeWidth={1.8} />
              </button>
            </div>

            {/* New event + Import events — only when section is expanded */}
            {eventOpen && (
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.6)', fontSize: 12,
                  cursor: 'pointer', width: '100%', fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              >
                <Plus width={13} height={13} strokeWidth={1.8} />
                New event
              </button>
            )}

            {eventOpen && (
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.6)', fontSize: 12,
                  cursor: 'pointer', width: '100%', fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
              >
                <Upload width={13} height={13} strokeWidth={1.8} />
                Import events
              </button>
            )}
          </div>
        )}

        {/* Connectors section — contextual to active timeline */}
        {!collapsed && (
          <div style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 6px 4px 16px' }}>
              <button
                onClick={() => setConnectorsOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flex: 1,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-sans)',
                  padding: 0,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Connectors
                </span>
                {connectorsOpen
                  ? <ChevronDown width={12} height={12} strokeWidth={2} />
                  : <ChevronRight width={12} height={12} strokeWidth={2} />}
              </button>
            </div>

            {connectorsOpen && (
              <>
                <div style={{
                  padding: '0 16px 4px',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.22)',
                  letterSpacing: '0.02em',
                }}>
                  {activeTimeline.name}
                </div>
                {/* Stub: connected Trello board */}
                <ConnectorItem name="Trello — Launch Board" status="Synced · 2 min ago" color="#0079BF" />
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 16px', background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.35)', fontSize: 12,
                    cursor: 'pointer', width: '100%', fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                >
                  <Plug width={13} height={13} strokeWidth={1.8} />
                  Add connector
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={onHandleMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 5,
            height: '100%',
            cursor: 'col-resize',
            zIndex: 20,
          }}
          onMouseEnter={e => ((e.currentTarget.lastElementChild as HTMLElement).style.background = 'var(--primary)')}
          onMouseLeave={e => ((e.currentTarget.lastElementChild as HTMLElement).style.background = 'transparent')}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 2,
              height: '100%',
              background: 'transparent',
              transition: 'background 0.15s',
              pointerEvents: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
