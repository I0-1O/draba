/* Backdrop.jsx — Simplified Draba timeline app chrome behind the share modal */

const BD_MEMBERS = [
  { id: 1, name: 'Lindsay K.', initials: 'LK', color: '#288C9B' },
  { id: 2, name: 'Jen M.',     initials: 'JM', color: '#F29E4C' },
  { id: 3, name: 'Brian R.',   initials: 'BR', color: '#9B59B6' },
  { id: 4, name: 'Sam T.',     initials: 'ST', color: '#2ECC71' },
];

const BD_EVENTS = [
  { id: 1, title: 'Q3 Campaign Launch', memberId: 1, color: '#288C9B', startCol: 0, span: 6 },
  { id: 2, title: 'Brand Refresh',      memberId: 1, color: '#5BC0DE', startCol: 7, span: 4 },
  { id: 3, title: 'Project Y',          memberId: 2, color: '#F29E4C', startCol: 3, span: 5 },
  { id: 4, title: 'Contractor Review',  memberId: 2, color: '#5C6BC0', startCol: 9, span: 3 },
  { id: 5, title: 'Task A',             memberId: 3, color: '#9B59B6', startCol: 0, span: 2 },
  { id: 6, title: 'Task B',             memberId: 3, color: '#9B59B6', startCol: 5, span: 5 },
  { id: 7, title: 'Onboarding',         memberId: 4, color: '#2ECC71', startCol: 1, span: 3 },
  { id: 8, title: 'Integration Work',   memberId: 4, color: '#2ECC71', startCol: 6, span: 6 },
];

const BD_DAYS = ['Apr 28','Apr 29','Apr 30','May 1','May 2','May 5','May 6','May 7','May 8','May 9','May 12','May 13'];

function BackdropIcon({ name, size = 18, color = 'currentColor', strokeWidth = 2 }) {
  return <i data-lucide={name} style={{ width: size, height: size, color, strokeWidth }}></i>;
}

function Backdrop({ onShare }) {
  const navItems = [
    { icon: 'calendar-range', label: 'Timeline', active: true },
    { icon: 'columns-3', label: 'Board', active: false },
    { icon: 'calendar', label: 'Calendar', active: false },
    { icon: 'users', label: 'Team', active: false },
    { icon: 'settings', label: 'Settings', active: false },
  ];

  const COL_W = 92;
  const ROW_H = 56;
  const NAME_W = 150;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--background)' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--card)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 6px', marginBottom: 22 }}>
          <img src="assets/icon-teal.svg" alt="" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>Draba</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(n => (
            <div key={n.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              background: n.active ? 'var(--muted)' : 'transparent',
              color: n.active ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: n.active ? 600 : 400, fontSize: 13.5 }}>
              <BackdropIcon name={n.icon} size={17} strokeWidth={n.active ? 2.2 : 1.8} />
              {n.label}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 6px',
          borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F29E4C', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>JM</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)' }}>Jen M.</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>jen@acme.co</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: 60, flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--card)',
          display: 'flex', alignItems: 'center', padding: '0 22px', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>Marketing timeline</h1>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 1 }}>Apr 28 – May 13 · 4 people</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }}>
              {BD_MEMBERS.map((m, i) => (
                <div key={m.id} title={m.name} style={{ width: 30, height: 30, borderRadius: '50%', background: m.color,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
                  border: '2px solid var(--card)', marginLeft: i === 0 ? 0 : -8 }}>{m.initials}</div>
              ))}
            </div>
            <button onClick={onShare} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600,
              padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              <BackdropIcon name="link" size={15} strokeWidth={2.2} />
              Share
            </button>
          </div>
        </header>

        {/* Timeline grid */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '4px 0 0' }}>
          <div style={{ minWidth: NAME_W + COL_W * BD_DAYS.length }}>
            {/* Day header */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: NAME_W, flexShrink: 0 }}></div>
              {BD_DAYS.map(d => (
                <div key={d} style={{ width: COL_W, flexShrink: 0, padding: '10px 0', textAlign: 'center',
                  fontSize: 11.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>{d}</div>
              ))}
            </div>
            {/* Rows */}
            {BD_MEMBERS.map(m => (
              <div key={m.id} style={{ display: 'flex', borderBottom: '1px solid var(--border)', position: 'relative', height: ROW_H }}>
                <div style={{ width: NAME_W, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>{m.initials}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                </div>
                {/* grid cells */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {BD_DAYS.map((d, i) => (
                      <div key={i} style={{ width: COL_W, flexShrink: 0, borderRight: '1px solid var(--border)' }}></div>
                    ))}
                  </div>
                  {BD_EVENTS.filter(e => e.memberId === m.id).map(e => (
                    <div key={e.id} style={{ position: 'absolute', top: 10, height: ROW_H - 20,
                      left: e.startCol * COL_W + 4, width: e.span * COL_W - 8,
                      background: e.color, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
                      padding: '0 10px', color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', boxShadow: 'var(--shadow-sm)' }}>{e.title}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Backdrop });
