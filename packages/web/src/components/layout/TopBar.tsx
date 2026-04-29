import { ChevronLeft, ChevronRight, GanttChart, Columns3, List, Share2, Plus } from 'lucide-react';

export type ViewMode = 'timeline' | 'kanban' | 'list';
export type ZoomLevel = 'day' | 'week' | 'month';

interface Props {
  title: string;
  dateRangeLabel: string;
  view: ViewMode;
  zoom: ZoomLevel;
  onViewChange: (view: ViewMode) => void;
  onZoomChange: (zoom: ZoomLevel) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onShare?: () => void;
  onAddEvent?: () => void;
}

const VIEWS: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
  { id: 'timeline', icon: <GanttChart size={13} strokeWidth={1.8} />, label: 'Timeline' },
  { id: 'kanban',   icon: <Columns3 size={13} strokeWidth={1.8} />,   label: 'Kanban' },
  { id: 'list',     icon: <List size={13} strokeWidth={1.8} />,       label: 'List' },
];

const ZOOMS: { id: ZoomLevel; label: string }[] = [
  { id: 'day',   label: 'Day' },
  { id: 'week',  label: 'Week' },
  { id: 'month', label: 'Month' },
];

const BTN_BASE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  border: 'none',
};

function IconBtn({ icon, onClick }: { icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...BTN_BASE,
        width: 28,
        height: 28,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--card)',
        color: 'var(--muted-foreground)',
      }}
    >
      {icon}
    </button>
  );
}

export default function TopBar({
  title,
  dateRangeLabel,
  view,
  zoom,
  onViewChange,
  onZoomChange,
  onPrev,
  onNext,
  onToday,
  onShare,
  onAddEvent,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        height: 'var(--topbar-h)',
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Timeline title */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--foreground)',
          marginRight: 4,
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <IconBtn icon={<ChevronLeft size={13} strokeWidth={2} />} onClick={onPrev} />
        <button
          onClick={onToday}
          style={{
            ...BTN_BASE,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--primary)',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 10px',
          }}
        >
          Today
        </button>
        <IconBtn icon={<ChevronRight size={13} strokeWidth={2} />} onClick={onNext} />
      </div>

      <span
        style={{
          fontSize: 12,
          color: 'var(--muted-foreground)',
          fontWeight: 400,
          whiteSpace: 'nowrap',
        }}
      >
        {dateRangeLabel}
      </span>

      {/* Zoom */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: 'var(--muted)',
          borderRadius: 'var(--radius-md)',
          padding: 2,
        }}
      >
        {ZOOMS.map(z => (
          <button
            key={z.id}
            onClick={() => onZoomChange(z.id)}
            style={{
              ...BTN_BASE,
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 5,
              background: zoom === z.id ? 'var(--card)' : 'transparent',
              color: zoom === z.id ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: zoom === z.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {z.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* View switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: 'var(--muted)',
          borderRadius: 'var(--radius-md)',
          padding: 2,
        }}
      >
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            style={{
              ...BTN_BASE,
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 5,
              background: view === v.id ? 'var(--card)' : 'transparent',
              color: view === v.id ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: view === v.id ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      {/* Share */}
      <button
        onClick={onShare}
        style={{
          ...BTN_BASE,
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
          padding: '6px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
        }}
      >
        <Share2 size={13} strokeWidth={2} />
        Share
      </button>

      {/* Add event */}
      <button
        onClick={onAddEvent}
        style={{
          ...BTN_BASE,
          gap: 5,
          fontSize: 13,
          fontWeight: 600,
          padding: '6px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--foreground)',
        }}
      >
        <Plus size={14} strokeWidth={2} />
        Add event
      </button>
    </div>
  );
}
