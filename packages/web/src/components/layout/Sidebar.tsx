import { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Plus,
  Settings2,
  Upload,
  CalendarPlus,
  Plug,
} from 'lucide-react';
import { Badge } from '@/components/identity/Badge';
import { useAuth } from '@/contexts/AuthContext';
import type { components } from '@draba/shared';

type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

const SIDEBAR_MIN = 220;
const SIDEBAR_MAX = 360;

interface ApiTeam {
  id: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  archivedAt?: string | null;
}

interface ApiTimeline {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  color?: string | null;
  icon?: string | null;
  archivedAt?: string | null;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onNewActivity?: () => void;
  /** Stub: bulk-import activities. Surfaced in the "New activity" combo dropdown. */
  onBulkImport?: () => void;
  apiTimelines?: ApiTimeline[];
  archivedTimelines?: ApiTimeline[];
  activeTimelineId?: string;
  onActiveTimelineChange?: (id: string) => void;
  onNewTimeline?: () => void;
  onEditTimeline?: (timelineId: string) => void;
  // Team management
  activeTeam?: ApiTeam;
  /** All non-archived teams. Used to render the switchable team list. */
  activeTeams?: ApiTeam[];
  archivedTeams?: ApiTeam[];
  onNewTeam?: () => void;
  onEditTeam?: (team: ApiTeam) => void;
  onSelectTeam?: (teamId: string) => void;
  onUnarchiveTeam?: (teamId: string) => void;
  /** True when the current user is an admin of the active team. */
  canEditTeam?: boolean;
  /** Live member list from the API. */
  members?: TeamMemberWithUser[];
  /** Called when the user clicks the gear icon on a member row. */
  onEditMember?: (member: TeamMemberWithUser) => void;
}

const ICON = { width: 15, height: 15, strokeWidth: 1.8 } as const;
const ICON_SM = { width: 13, height: 13, strokeWidth: 1.8 } as const;
const ICON_XS = { width: 11, height: 11, strokeWidth: 2 } as const;

interface Timeline {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  startDate?: string;
  endDate?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return ''
  const s = new Date(startDate + 'T00:00:00')
  const e = new Date(endDate + 'T00:00:00')
  const diffDays = (e.getTime() - s.getTime()) / 86_400_000
  if (diffDays < 90) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()} ${e.getFullYear()}`
  }
  return `${MONTHS[s.getMonth()]} ${s.getFullYear()} – ${MONTHS[e.getMonth()]} ${e.getFullYear()}`
}


interface TimelineItemProps {
  timeline: Timeline;
  active: boolean;
  collapsed: boolean;
  showDate?: boolean;
  canEdit?: boolean;
  onClick: () => void;
  onSettings: () => void;
}

function TimelineItem({ timeline, active, collapsed, showDate = true, canEdit = false, onClick, onSettings }: TimelineItemProps) {
  const [hovered, setHovered] = useState(false);
  const dateRange = !collapsed && showDate ? formatDateRange(timeline.startDate, timeline.endDate) : ''

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
          padding: collapsed ? '7px 14px' : '6px 8px 6px 16px',
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
        <Badge
          identity={{ color: timeline.color, icon: timeline.icon ?? '__none__' }}
          name={timeline.name}
          shape="square"
          size={20}
        />
        {!collapsed && (
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {timeline.name}
            </div>
            {dateRange && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dateRange}
              </div>
            )}
          </div>
        )}
      </button>

      {!collapsed && canEdit && (
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

// ── TeamRow ──────────────────────────────────────────────────────────────────

interface TeamRowProps {
  team: ApiTeam;
  isActive: boolean;
  canEdit: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
}

function TeamRow({ team, isActive, canEdit, onSelect, onEdit }: TeamRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!isActive) onSelect?.(); }}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 6px 5px 16px',
        borderLeft: isActive ? `2px solid ${team.color ?? 'var(--primary)'}` : '2px solid transparent',
        background: isActive ? 'rgba(255,255,255,0.07)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        cursor: isActive ? 'default' : 'pointer',
        minHeight: 34,
        transition: 'background 0.12s',
      }}
    >
      <Badge
        identity={{ color: team.color ?? 'var(--primary)', icon: team.icon ?? '__name_1__' }}
        name={team.name}
        shape="square"
        size={20}
      />
      <span style={{
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
        flex: 1,
        marginLeft: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {team.name}
      </span>
      {canEdit && (
        <button
          title="Team settings"
          onClick={e => { e.stopPropagation(); onEdit?.(); }}
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

// ── MemberSidebarRow ──────────────────────────────────────────────────────────

interface MemberSidebarRowProps {
  displayName: string;
  color: string;
  icon?: string | null;
  isInactive?: boolean;
  onEdit?: () => void;
}

function MemberSidebarRow({ displayName, color, icon, isInactive = false, onEdit }: MemberSidebarRowProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 6px 4px 16px', cursor: 'default',
        background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        opacity: isInactive ? 0.45 : 1,
      }}
    >
      <Badge
        identity={{ color, icon: icon ?? '__name_words__' }}
        name={displayName}
        shape="circle"
        size={20}
      />
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {displayName}
      </span>
      {onEdit && (
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title={`Edit ${displayName}`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, marginRight: 6,
            background: 'none', border: 'none', borderRadius: 4,
            color: 'rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0,
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.12s',
            pointerEvents: hovered ? 'auto' : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
        >
          <Settings2 width={12} height={12} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

/**
 * Left navigation rail: brand, team selector with members, and timeline list.
 * Collapsed/expanded state is driven by the parent.
 */
const TIMELINE_COLORS = ['#1A97A2', '#6366F1', '#F17B2B', '#E11D48', '#10B981', '#F59E0B']

export default function Sidebar({ collapsed, onToggle, onNewActivity, onBulkImport, apiTimelines, archivedTimelines = [], activeTimelineId, onActiveTimelineChange, onNewTimeline, onEditTimeline, activeTeam, activeTeams = [], archivedTeams = [], onNewTeam, onEditTeam, onSelectTeam, canEditTeam = false, members: apiMembers, onEditMember }: Props) {
  const { user } = useAuth();
  const currentUserId = (user as { id?: string } | null)?.id;
  const [internalActiveId, setInternalActiveId] = useState('');
  const [teamOpen, setTeamOpen] = useState(true);
  const [connectorsOpen, setConnectorsOpen] = useState(true);
  // Combo "New activity" dropdown (expanded + collapsed share this state).
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  // Collapsed-mode menu is rendered fixed (the rail clips overflow), so we
  // capture the trigger's viewport rect when it opens.
  const [collapsedMenuPos, setCollapsedMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Primary accent for the "New activity" combo button.
  const NEW_BTN_BG = 'var(--primary)';
  const NEW_BTN_FG = 'var(--primary-foreground)';
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [timelinesOpen, setTimelinesOpen] = useState(true);
  const [membersOpen, setMembersOpen] = useState(true);
  const [archivedTeamsOpen, setArchivedTeamsOpen] = useState(false);

  const allExpanded = teamOpen && timelinesOpen && connectorsOpen && membersOpen;
  function toggleAllSections() {
    const next = !allExpanded;
    setTeamOpen(next);
    setTimelinesOpen(next);
    setConnectorsOpen(next);
    setMembersOpen(next);
    if (!next) {
      setArchivedOpen(false);
      setArchivedTeamsOpen(false);
    }
  }

  const timelines: Timeline[] = (apiTimelines ?? []).map((t, i) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? TIMELINE_COLORS[i % TIMELINE_COLORS.length],
    icon: t.icon ?? null,
    startDate: t.startDate,
    endDate: t.endDate,
  }))

  const archivedTimelineItems: Timeline[] = archivedTimelines.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? '#64748B',
    icon: t.icon ?? null,
    startDate: t.startDate,
    endDate: t.endDate,
  }))
  const activeId = activeTimelineId ?? internalActiveId
  const activeTimeline = timelines.find(t => t.id === activeId) ?? timelines[0] ?? null;

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

  // Close the "New activity" dropdown on outside click or Escape.
  useEffect(() => {
    if (!newMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setNewMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [newMenuOpen]);

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
        transition: 'width 0.2s ease',
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
            <img src="/logo-orange-white.svg" alt="Draba" style={{ width: 28, height: 28, marginTop: 3 }} />
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'white' }}>
              draba
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {!collapsed && (
            <button
              onClick={toggleAllSections}
              title={allExpanded ? 'Collapse all sections' : 'Expand all sections'}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.45)',
                borderRadius: 6,
                width: 26,
                height: 26,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
            >
              {allExpanded ? <ChevronsDownUp width={14} height={14} strokeWidth={1.8} /> : <ChevronsUpDown width={14} height={14} strokeWidth={1.8} />}
            </button>
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
      </div>

      {/* Primary "New activity" combo button — sits directly under the brand. */}
      {!collapsed && (
        <div
          ref={newMenuRef}
          style={{ position: 'relative', padding: '12px 16px 2px', flexShrink: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            <button
              onClick={onNewActivity}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '9px 12px',
                background: NEW_BTN_BG,
                border: 'none',
                borderRadius: '7px 0 0 7px',
                color: NEW_BTN_FG,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <CalendarPlus width={15} height={15} strokeWidth={2} />
              New activity
            </button>
            <button
              title="More activity options"
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
              onClick={() => setNewMenuOpen(o => !o)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                background: NEW_BTN_BG,
                border: 'none',
                borderLeft: '1px solid rgba(0,0,0,0.18)',
                borderRadius: '0 7px 7px 0',
                color: NEW_BTN_FG,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              <ChevronDown
                width={14}
                height={14}
                strokeWidth={2}
                style={{ transform: newMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}
              />
            </button>
          </div>

          {newMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% - 4px)',
                left: 16,
                right: 16,
                background: 'var(--color-charcoal)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 7,
                boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                padding: 4,
                zIndex: 30,
              }}
            >
              <button
                role="menuitem"
                onClick={() => { setNewMenuOpen(false); onBulkImport?.(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', width: '100%',
                  background: 'none', border: 'none', borderRadius: 5,
                  color: 'rgba(255,255,255,0.75)', fontSize: 13,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <Upload width={14} height={14} strokeWidth={1.8} />
                Bulk import
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Collapsed: team + timeline icons only */}
        {collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
            {/* Active team badge — click to expand */}
            <div
              title={activeTeam?.name ?? 'Team'}
              onClick={onToggle}
              style={{ cursor: 'pointer', flexShrink: 0 }}
            >
              <Badge
                identity={{ color: activeTeam?.color ?? 'var(--primary)', icon: activeTeam?.icon ?? '__name_1__' }}
                name={activeTeam?.name ?? ''}
                shape="square"
                size={28}
              />
            </div>
            {/* Active timeline — click to expand */}
            {activeTimeline && (
              <div
                title={activeTimeline.name}
                onClick={onToggle}
                style={{ cursor: 'pointer' }}
              >
                <Badge
                  identity={{ color: activeTimeline.color, icon: activeTimeline.icon ?? '__none__' }}
                  name={activeTimeline.name}
                  shape="square"
                  size={28}
                />
              </div>
            )}

            {/* New activity combo — icon button opens a menu with both actions.
                order:-1 keeps it at the top, matching the expanded layout. */}
            <div ref={newMenuRef} style={{ position: 'relative', flexShrink: 0, order: -1, marginBottom: 2 }}>
              <button
                title="New activity"
                aria-haspopup="menu"
                aria-expanded={newMenuOpen}
                onClick={e => {
                  if (newMenuOpen) { setNewMenuOpen(false); return; }
                  const r = e.currentTarget.getBoundingClientRect();
                  setCollapsedMenuPos({ top: r.top, left: r.right + 6 });
                  setNewMenuOpen(true);
                }}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  background: NEW_BTN_BG,
                  border: 'none',
                  color: NEW_BTN_FG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                <CalendarPlus width={16} height={16} strokeWidth={2} />
              </button>

              {newMenuOpen && collapsedMenuPos && (
                <div
                  role="menu"
                  style={{
                    position: 'fixed',
                    top: collapsedMenuPos.top,
                    left: collapsedMenuPos.left,
                    minWidth: 160,
                    background: 'var(--color-charcoal)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 7,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    padding: 4,
                    zIndex: 30,
                  }}
                >
                  <button
                    role="menuitem"
                    onClick={() => { setNewMenuOpen(false); onNewActivity?.(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', width: '100%',
                      background: 'none', border: 'none', borderRadius: 5,
                      color: 'rgba(255,255,255,0.75)', fontSize: 13,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <CalendarPlus width={14} height={14} strokeWidth={1.8} />
                    New activity
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setNewMenuOpen(false); onBulkImport?.(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', width: '100%',
                      background: 'none', border: 'none', borderRadius: 5,
                      color: 'rgba(255,255,255,0.75)', fontSize: 13,
                      cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Upload width={14} height={14} strokeWidth={1.8} />
                    Bulk import
                  </button>
                </div>
              )}
            </div>
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
                padding: '6px 12px 6px 16px',
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

            {/* Team rows — active team highlighted; others clickable to switch */}
            {(teamOpen ? activeTeams : activeTeam ? [activeTeam] : []).map(t => (
              <TeamRow
                key={t.id}
                team={t}
                isActive={t.id === activeTeam?.id}
                canEdit={canEditTeam}
                onSelect={() => onSelectTeam?.(t.id)}
                onEdit={() => onEditTeam?.(t)}
              />
            ))}
            {/* Fallback when activeTeams not yet loaded but activeTeam is known */}
            {!activeTeams.length && activeTeam && (
              <TeamRow
                team={activeTeam}
                isActive
                canEdit={canEditTeam}
                onEdit={() => onEditTeam?.(activeTeam)}
              />
            )}

            {/* New team button — only superadmins get onNewTeam passed from the parent */}
            {teamOpen && onNewTeam && (
              <button
                onClick={onNewTeam}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 16px', background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)', fontSize: 12,
                  cursor: 'pointer', width: '100%', fontFamily: 'var(--font-sans)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                <Plus {...ICON_SM} />
                New team
              </button>
            )}

            {/* Archived teams — collapsible sub-section, shown when team section is open */}
            {teamOpen && archivedTeams.length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedTeamsOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    width: '100%', padding: '4px 8px 4px 16px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
                >
                  {archivedTeamsOpen
                    ? <ChevronDown {...ICON_XS} />
                    : <ChevronRight {...ICON_XS} />}
                  <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Archived ({archivedTeams.length})
                  </span>
                </button>
                {archivedTeamsOpen && archivedTeams.map(t => (
                  <TeamRow
                    key={t.id}
                    team={t}
                    isActive={false}
                    canEdit={Boolean(onNewTeam)}
                    onEdit={() => onEditTeam?.(t)}
                  />
                ))}
              </div>
            )}

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
                    {(apiMembers ?? []).map(m => {
                      const displayName = (m as TeamMemberWithUser).displayName || m.id;
                      const color = m.color ?? '#8b949e';
                      const icon = (m as TeamMemberWithUser).icon ?? null;
                      return (
                        <MemberSidebarRow
                          key={m.id}
                          displayName={displayName}
                          color={color}
                          icon={icon}
                          isInactive={Boolean((m as TeamMemberWithUser).archivedAt)}
                          onEdit={onEditMember && (m as TeamMemberWithUser).userId !== currentUserId
                            ? () => onEditMember(m as TeamMemberWithUser)
                            : undefined}
                        />
                      );
                    })}
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
              {timelines.map(tl => (
                <TimelineItem
                  key={tl.id}
                  timeline={tl}
                  active={activeId === tl.id}
                  collapsed={false}
                  canEdit={canEditTeam}
                  onClick={() => { setInternalActiveId(tl.id); onActiveTimelineChange?.(tl.id); }}
                  onSettings={() => onEditTimeline?.(tl.id)}
                />
              ))}
              <button
                onClick={onNewTimeline}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 12,
                  cursor: onNewTimeline ? 'pointer' : 'default',
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
              {archivedTimelineItems.length > 0 && (
                <>
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
                    <span style={{ fontSize: 10, marginLeft: 4 }}>({archivedTimelineItems.length})</span>
                  </button>

                  {archivedOpen && (
                    <div style={{ opacity: 0.6 }}>
                      {archivedTimelineItems.map(tl => (
                        <TimelineItem
                          key={tl.id}
                          timeline={tl}
                          active={false}
                          collapsed={false}
                          canEdit={canEditTeam}
                          onClick={() => {}}
                          onSettings={() => onEditTimeline?.(tl.id)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            /* Section collapsed: show just the active timeline */
            <TimelineItem
              timeline={activeTimeline}
              active={true}
              collapsed={false}
              showDate={false}
              canEdit={canEditTeam}
              onClick={() => setTimelinesOpen(true)}
              onSettings={() => onEditTimeline?.(activeTimeline.id)}
            />
          ))}
        </div>
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
                  {activeTimeline?.name}
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
