/* ExportModal.jsx — Draba "Export this view" dialog (Phase 14)
   Descriptor-driven: one dialog serves Gantt / List / Kanban / Calendar.
   Adding a view or format = adding a descriptor, not redesigning the dialog. */

const XM_VIEW_NAMES = { gantt: 'Gantt', list: 'List', kanban: 'Kanban', calendar: 'Calendar' };

/* Filter context fixtures (driven by the Tweaks panel) */
const XM_FILTERS = {
  filtered: { label: 'Status is In progress', visible: 23, total: 61 },
  none:     { label: null,                    visible: 61, total: 61 },
  empty:    { label: 'Status is Blocked',     visible: 0,  total: 61 },
};

/* Capability matrix — `views` omitted means "all views".
   verb: 'download' | 'copy' | 'print' (three distinct action types) */
const XM_FORMATS = [
  { id: 'csv',  name: 'CSV',             icon: 'table',            verb: 'download', ext: '.csv',  scope: true,
    desc: 'One row per activity. Opens in Excel, Numbers, or Google Sheets.' },
  { id: 'xlsx', name: 'Excel',           icon: 'file-spreadsheet', verb: 'download', ext: '.xlsx', scope: true,
    desc: 'An .xlsx workbook with typed columns — dates stay dates.' },
  { id: 'ics',  name: 'Calendar (.ics)', icon: 'calendar-plus',    verb: 'download', ext: '.ics',  scope: true,
    desc: 'Import activities as events into Google Calendar, Outlook, or Apple Calendar.' },
  { id: 'md',   name: 'Markdown',        icon: 'file-text',        verb: 'copy', ext: '.md', secondaryDownload: true, header: true,
    views: ['list', 'kanban', 'calendar'],
    desc: 'A formatted outline of this view — paste into Notion, Slack, or a doc.' },
  { id: 'txt',  name: 'Plain text',      icon: 'align-left',       verb: 'copy', header: true,
    views: ['list', 'kanban', 'calendar'],
    desc: 'A simple indented list for email, or anywhere Markdown won\u2019t render.' },
  { id: 'png',  name: 'PNG image',       icon: 'image',            verb: 'download', ext: '.png', generating: true, header: true,
    desc: 'A snapshot of this view — light theme, 2\u00d7 resolution, full extent.' },
  { id: 'print', name: 'Printable view', icon: 'printer',          verb: 'print', header: true,
    desc: 'A clean print-styled page. Save as PDF from your browser\u2019s print dialog.' },
];

const XM_VERB_META = {
  download: { icon: 'download',      label: 'Download' },
  copy:     { icon: 'copy',          label: 'Copy' },
  print:    { icon: 'external-link', label: 'New tab' },
};

const XMIcon = ({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) =>
  <i data-lucide={name} style={{ width: size, height: size, color, strokeWidth, flexShrink: 0 }}></i>;

/* ── Scope picker (data formats only) ────────────────────────────────── */
function XmScopePicker({ scope, setScope, filter }) {
  const rows = [
    { id: 'view', title: 'Current view',
      sub: filter.label
        ? `${filter.visible} of ${filter.total} activities \u00b7 matches your filter`
        : `All ${filter.total} activities \u00b7 nothing filtered out` },
    { id: 'all', title: 'Entire timeline',
      sub: `All ${filter.total} activities \u00b7 ignores filters` },
  ];
  return (
    <div role="radiogroup" aria-label="Scope" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {rows.map((r, i) => {
        const on = scope === r.id;
        return (
          <button key={r.id} role="radio" aria-checked={on} onClick={() => setScope(r.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '10px 12px', border: 'none', background: on ? 'color-mix(in srgb, var(--primary) 9%, transparent)' : 'transparent',
              borderTop: i > 0 ? '1px solid var(--border)' : 'none', fontFamily: 'var(--font-sans)' }}>
            <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
              border: on ? '5px solid var(--primary)' : '1.5px solid var(--input)',
              background: on ? 'var(--primary-foreground)' : 'transparent', transition: 'border .12s' }}></span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{r.title}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 1 }}>{r.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Context strip — makes "export what I'm seeing" visibly true ─────── */
function XmContextStrip({ filter, viewName }) {
  const isEmpty = filter.visible === 0;
  const badge = filter.label ? `${filter.visible} of ${filter.total} activities` : `All ${filter.total} activities`;
  return (
    <div style={{ borderRadius: 'var(--radius-lg)', padding: '9px 12px',
      background: isEmpty ? 'color-mix(in srgb, var(--warning) 13%, transparent)' : 'var(--muted)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <XMIcon name={isEmpty ? 'alert-triangle' : 'filter'} size={14}
          color={isEmpty ? 'var(--warning)' : 'var(--muted-foreground)'} strokeWidth={2.2} />
        <span style={{ fontSize: 12.5, color: 'var(--foreground)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filter.label
            ? <span>Filtered: <strong style={{ fontWeight: 600 }}>{filter.label}</strong></span>
            : <span>Exporting the {viewName} view as you see it</span>}
        </span>
        <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11.5, fontWeight: 600,
          color: isEmpty ? 'var(--warning)' : 'var(--muted-foreground)' }}>{badge}</span>
      </div>
      {isEmpty && (
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.45, margin: '5px 0 0 22px' }}>
          This view has no activities — the export will be empty or headers-only.
        </p>
      )}
    </div>
  );
}

/* ── Right pane blocks ───────────────────────────────────────────────── */
function XmFieldLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.06em',
    textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>;
}

function XmFilenameChip({ ext }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', background: 'var(--muted)',
      borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--foreground)' }}>
      <XMIcon name="file-down" size={13} color="var(--muted-foreground)" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        marketing-timeline-2026-06-12<span style={{ color: 'var(--muted-foreground)' }}>{ext}</span>
      </span>
    </div>
  );
}

function XmHeaderStripHint({ filter }) {
  return (
    <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '8px 11px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.07em',
        textTransform: 'uppercase', marginBottom: 3 }}>Includes header strip</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        Acme Co &middot; Marketing timeline &middot; Generated Jun 12, 2026{filter.label ? <span> &middot; {filter.label}</span> : null}
      </div>
    </div>
  );
}

/* ── The modal ───────────────────────────────────────────────────────── */
function ExportModal({ view, filterKey, onClose }) {
  const filter = XM_FILTERS[filterKey] || XM_FILTERS.none;
  const viewName = XM_VIEW_NAMES[view] || 'List';
  const formats = XM_FORMATS.filter(f => !f.views || f.views.includes(view));

  const [formatId, setFormatId] = React.useState('csv');
  const [scope, setScope] = React.useState('view');
  const [phase, setPhase] = React.useState('idle'); // idle | generating | done | copied | opened
  const timers = React.useRef([]);

  // keep selection valid when the view tweak changes the available formats
  React.useEffect(() => {
    if (!formats.some(f => f.id === formatId)) setFormatId('csv');
  }, [view]); // eslint-disable-line

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);
  React.useEffect(() => { if (window.lucide) lucide.createIcons(); });
  React.useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fmt = formats.find(f => f.id === formatId) || formats[0];

  function later(ms, fn) { timers.current.push(setTimeout(fn, ms)); }
  function selectFormat(id) { setFormatId(id); setPhase('idle'); }

  function act() {
    if (phase === 'generating') return;
    if (fmt.verb === 'copy') {
      if (navigator.clipboard) navigator.clipboard.writeText('(exported ' + fmt.name + ')').catch(() => {});
      setPhase('copied'); later(1600, () => setPhase('idle'));
    } else if (fmt.verb === 'print') {
      setPhase('opened'); later(1600, () => setPhase('idle'));
    } else if (fmt.generating) {
      setPhase('generating'); later(1500, () => { setPhase('done'); later(1600, () => setPhase('idle')); });
    } else {
      setPhase('done'); later(1600, () => setPhase('idle'));
    }
  }

  /* primary button content per verb + phase */
  let primaryIcon = 'download', primaryLabel = 'Download ' + (fmt.ext || '');
  if (fmt.verb === 'copy')  { primaryIcon = 'copy'; primaryLabel = 'Copy to clipboard'; }
  if (fmt.verb === 'print') { primaryIcon = 'external-link'; primaryLabel = 'Open printable view'; }
  if (phase === 'copied')     { primaryIcon = 'check'; primaryLabel = 'Copied'; }
  if (phase === 'opened')     { primaryIcon = 'check'; primaryLabel = 'Opened in new tab'; }
  if (phase === 'done')       { primaryIcon = 'check'; primaryLabel = 'Downloaded'; }
  if (phase === 'generating') { primaryIcon = 'loader-2'; primaryLabel = 'Generating\u2026'; }
  const primarySuccess = phase === 'copied' || phase === 'done' || phase === 'opened';

  const btnBase = { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600,
    padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'background .15s, color .15s' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgb(20 28 33 / 0.55)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'sm-fade .15s ease' }}>
      <div onClick={e => e.stopPropagation()} data-screen-label="Export dialog"
        style={{ width: 'min(620px, 100%)', maxHeight: '88vh',
        background: 'var(--card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'sm-pop .18s cubic-bezier(.2,.7,.3,1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 14px', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-md)',
            background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XMIcon name="file-output" size={19} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.25 }}>Export this view</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#F29E4C', display: 'inline-block', flexShrink: 0 }}></span>
              Marketing timeline &middot; {viewName} view
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, flexShrink: 0, border: 'none',
            background: 'var(--muted)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <XMIcon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Filter context strip */}
        <div style={{ padding: '0 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <XmContextStrip filter={filter} viewName={viewName} />
        </div>

        {/* Body: format rail + options pane */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
          <div role="listbox" aria-label="Export format" style={{ width: 196, flexShrink: 0, overflowY: 'auto',
            borderRight: '1px solid var(--border)', padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formats.map(f => {
              const on = f.id === fmt.id;
              const verb = XM_VERB_META[f.verb];
              return (
                <button key={f.id} role="option" aria-selected={on} onClick={() => selectFormat(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
                    padding: '8px 9px', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: 'none',
                    fontFamily: 'var(--font-sans)',
                    background: on ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent' }}
                  onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'var(--muted)'; }}
                  onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <XMIcon name={f.icon} size={15} color={on ? 'var(--primary)' : 'var(--muted-foreground)'} strokeWidth={on ? 2.2 : 1.8} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: on ? 600 : 400,
                    color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span title={verb.label} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                    color: 'var(--muted-foreground)', opacity: on ? 0.9 : 0.65 }}>
                    <XMIcon name={verb.icon} size={11} strokeWidth={2} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Options pane */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px 18px',
            display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{fmt.name}</div>
              <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', lineHeight: 1.5, marginTop: 3 }}>{fmt.desc}</p>
            </div>

            {fmt.scope && (
              <div>
                <XmFieldLabel>Activities to export</XmFieldLabel>
                <XmScopePicker scope={scope} setScope={setScope} filter={filter} />
              </div>
            )}

            {fmt.verb === 'download' && (
              <div>
                <XmFieldLabel>File</XmFieldLabel>
                <XmFilenameChip ext={fmt.ext} />
              </div>
            )}

            {fmt.header && <XmHeaderStripHint filter={filter} />}

            {fmt.verb === 'print' && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5,
                color: 'var(--muted-foreground)' }}>
                <span style={{ marginTop: 1 }}><XMIcon name="info" size={13} strokeWidth={2} /></span>
                <span>Opens in a new tab and starts your browser&rsquo;s print dialog — choose &ldquo;Save as PDF&rdquo; there for a crisp vector PDF.</span>
              </div>
            )}

            {fmt.generating && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, lineHeight: 1.5,
                color: 'var(--muted-foreground)' }}>
                <span style={{ marginTop: 1 }}><XMIcon name="info" size={13} strokeWidth={2} /></span>
                <span>Rendered on your device — large timelines can take a few seconds.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px',
          borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={onClose} style={{ ...btnBase, marginLeft: 'auto', border: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--foreground)' }}>Cancel</button>

          {fmt.secondaryDownload && (
            <button onClick={() => {}} style={{ ...btnBase, border: '1px solid var(--border)',
              background: 'var(--card)', color: 'var(--foreground)' }}>
              <XMIcon name="download" size={14} strokeWidth={2.2} /> Download {fmt.ext}
            </button>
          )}

          <button onClick={act} disabled={phase === 'generating'}
            style={{ ...btnBase, border: 'none',
              cursor: phase === 'generating' ? 'default' : 'pointer',
              background: primarySuccess ? 'var(--success)' : 'var(--primary)',
              color: primarySuccess ? 'var(--success-foreground)' : 'var(--primary-foreground)',
              opacity: phase === 'generating' ? 0.75 : 1, minWidth: 168, justifyContent: 'center' }}>
            <span style={phase === 'generating' ? { display: 'flex', animation: 'xm-spin 0.9s linear infinite' } : { display: 'flex' }}>
              <XMIcon name={primaryIcon} size={14} strokeWidth={2.2} />
            </span>
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ExportModal });
