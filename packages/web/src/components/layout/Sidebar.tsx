import { useState } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  LayoutPanelLeft,
  Users,
  Settings,
  Plus,
} from 'lucide-react';

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

/**
 * A single nav row inside the sidebar. Renders the label only when the
 * sidebar is expanded; otherwise the label is exposed via `title=` for
 * native tooltip / accessibility.
 */
function SidebarItem({ icon, label, active = false, collapsed, onClick }: SidebarItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: collapsed ? '8px 14px' : '7px 16px',
        background: active
          ? 'rgba(255,255,255,0.12)'
          : hovered
          ? 'rgba(255,255,255,0.06)'
          : 'transparent',
        border: 'none',
        color: active ? 'white' : 'rgba(255,255,255,0.6)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        width: '100%',
        borderRadius: 0,
        transition: 'background 0.12s, color 0.12s',
        borderLeft: active ? '2px solid var(--primary)' : '2px solid transparent',
        fontFamily: 'var(--font-sans)',
        textAlign: 'left',
      }}
    >
      {icon}
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      )}
    </button>
  );
}

const ICON = { width: 15, height: 15, strokeWidth: 1.8, flexShrink: 0 } as const;

// Placeholder timelines — replaced when API layer is wired
const DEMO_TIMELINES = ['Engineering Q2', 'Design Sprint', 'Marketing Q3'];

/**
 * Left navigation rail: brand, team selector, timeline list, and the
 * current-user footer. The collapsed/expanded state is driven by the
 * parent so the layout can react (TopBar offset, content width).
 */
export default function Sidebar({ collapsed, onToggle }: Props) {
  const [activeTimeline, setActiveTimeline] = useState(DEMO_TIMELINES[0]);

  return (
    <div
      style={{
        width: collapsed ? 52 : 'var(--sidebar-w)',
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
          justifyContent: 'space-between',
          padding: collapsed ? '16px 14px' : '16px 14px 16px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          minHeight: 56,
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            {/* Logo: place icon-white-on-black-circle.svg in public/ as logo.svg */}
            <img src="/logo.svg" alt="Draba" style={{ width: 28, height: 28 }} />
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'white',
              }}
            >
              draba
            </span>
          </div>
        )}
        {collapsed && <img src="/logo.svg" alt="Draba" style={{ width: 26, height: 26 }} />}
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
            marginLeft: collapsed ? 'auto' : 0,
          }}
        >
          {collapsed ? (
            <ChevronRight {...ICON} />
          ) : (
            <ChevronLeft {...ICON} />
          )}
        </button>
      </div>

      {/* Team selector */}
      {!collapsed && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'white', flex: 1 }}>
              Acme Corp
            </span>
            <ChevronsUpDown {...ICON} style={{ color: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        {!collapsed && (
          <div
            style={{
              padding: '6px 16px 4px',
              fontSize: 10,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Timelines
          </div>
        )}

        {DEMO_TIMELINES.map(tl => (
          <SidebarItem
            key={tl}
            icon={<LayoutPanelLeft {...ICON} />}
            label={tl}
            active={activeTimeline === tl}
            collapsed={collapsed}
            onClick={() => setActiveTimeline(tl)}
          />
        ))}

        {!collapsed && (
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: 12,
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <Plus {...ICON} />
            New timeline
          </button>
        )}

        <div
          style={{
            height: 1,
            background: 'rgba(255,255,255,0.08)',
            margin: '8px 12px',
          }}
        />

        <SidebarItem icon={<Users {...ICON} />} label="Team" collapsed={collapsed} />
        <SidebarItem icon={<Settings {...ICON} />} label="Settings" collapsed={collapsed} />
      </div>

      {/* User footer — placeholder until auth is wired */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          LK
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Lindsay K.
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              lindsay@acme.com
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
