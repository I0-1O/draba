/* ShareModal.jsx — Draba "Share this view" modal */

const SM_MEMBERS = {
  1: { id: 1, name: 'Lindsay K.', initials: 'LK', color: '#288C9B' },
  2: { id: 2, name: 'Jen M.',     initials: 'JM', color: '#F29E4C' },
  3: { id: 3, name: 'Brian R.',   initials: 'BR', color: '#9B59B6' },
  4: { id: 4, name: 'Sam T.',     initials: 'ST', color: '#2ECC71' },
};

const SHARES_INIT = [
  { id: 'a', title: 'Acme stakeholder view', creatorId: 1, created: 'Apr 22',
    desc: 'Read-only status for the weekly Acme client review. Updated automatically.',
    slug: 'k2p9xq', views: 48, protected: true },
  { id: 'b', title: 'All-hands public link', creatorId: 2, created: 'Apr 28',
    desc: 'Public link embedded in the company all-hands deck.',
    slug: 'mktg-q3', views: 126, protected: false },
  { id: 'c', title: 'Design contractor view', creatorId: 3, created: 'May 1',
    desc: 'Scoped view for the two external design contractors.',
    slug: 'c7m4tb', views: 9, protected: true },
];

const SMIcon = ({ name, size = 16, color = 'currentColor', strokeWidth = 2 }) =>
  <i data-lucide={name} style={{ width: size, height: size, color, strokeWidth }}></i>;

function makeSlug() {
  const c = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

function MiniAvatar({ member, size = 22 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: member.color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.4),
      fontWeight: 700, flexShrink: 0 }}>{member.initials}</div>
  );
}

/* ── A single share row ──────────────────────────────────────────────── */
function ShareRow({ share, canDelete, isOwn, onDelete }) {
  const [copied, setCopied] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const creator = SM_MEMBERS[share.creatorId];
  const url = `draba.app/v/${share.slug}`;

  function copy() {
    setCopied(true);
    if (navigator.clipboard) navigator.clipboard.writeText('https://' + url).catch(() => {});
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      background: 'var(--card)', padding: 14, boxShadow: 'var(--shadow-sm)' }}>
      {/* Top: title + actions */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', flexShrink: 0,
          background: share.protected ? 'hsl(30 87% 62% / 0.16)' : 'hsl(188 59% 38% / 0.12)',
          color: share.protected ? 'var(--secondary)' : 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SMIcon name={share.protected ? 'lock' : 'link'} size={16} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{share.title}</span>
            {share.protected && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                color: 'var(--secondary-foreground)', background: 'hsl(30 87% 62% / 0.22)', padding: '1px 8px',
                borderRadius: 'var(--radius-full)' }}>
                <SMIcon name="lock" size={10} strokeWidth={2.4} /> password
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 3, lineHeight: 1.45 }}>{share.desc}</p>
        </div>
        {canDelete && (
          <button onClick={() => setConfirming(true)} title="Delete share"
            style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-md)', border: 'none',
              background: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'hsl(0 72% 51% / 0.1)'; e.currentTarget.style.color = 'var(--destructive)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)'; }}>
            <SMIcon name="trash-2" size={15} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* URL row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px',
          background: 'var(--muted)', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)',
          fontSize: 12.5, color: 'var(--foreground)' }}>
          <SMIcon name="link-2" size={13} color="var(--muted-foreground)" strokeWidth={2} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</span>
        </div>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 12.5,
          fontWeight: 600, padding: '7px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
          border: '1px solid ' + (copied ? 'var(--success)' : 'var(--border)'),
          background: copied ? 'hsl(145 63% 42% / 0.12)' : 'var(--card)',
          color: copied ? 'var(--success)' : 'var(--foreground)', transition: 'all .15s' }}>
          <SMIcon name={copied ? 'check' : 'copy'} size={13} strokeWidth={2.2} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Footer meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, fontSize: 12, color: 'var(--muted-foreground)' }}>
        <MiniAvatar member={creator} size={20} />
        <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{creator.name}{isOwn && <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}> · you</span>}</span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span>{share.created}</span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <SMIcon name="eye" size={12} strokeWidth={2} />{share.views} views
        </span>
      </div>

      {/* Inline delete confirm */}
      {confirming && (
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--radius-lg)', background: 'var(--card)',
          border: '1px solid var(--destructive)', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '14px 16px', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 'var(--radius-md)', background: 'hsl(0 72% 51% / 0.1)',
              color: 'var(--destructive)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SMIcon name="trash-2" size={15} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--foreground)' }}>Delete this share?</div>
              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>Anyone with the link will immediately lose access. This can't be undone.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirming(false)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px',
              borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => onDelete(share.id)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 14px',
              borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--destructive)',
              color: 'var(--destructive-foreground)', cursor: 'pointer' }}>Delete link</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── The add-share inline form ───────────────────────────────────────── */
function AddShareForm({ currentUser, onCreate, onCancel }) {
  const [title, setTitle] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [pwOn, setPwOn] = React.useState(false);
  const [pw, setPw] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const titleRef = React.useRef(null);

  React.useEffect(() => { if (titleRef.current) titleRef.current.focus(); }, []);

  const valid = title.trim().length > 0 && (!pwOn || pw.trim().length > 0);
  const inputBase = { width: '100%', fontSize: 13, color: 'var(--foreground)', padding: '8px 11px',
    border: '1px solid var(--input)', borderRadius: 'var(--radius-md)', background: 'var(--card)',
    outline: 'none', fontFamily: 'var(--font-sans)' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 5,
    display: 'block', letterSpacing: '0.02em' };

  function submit() {
    if (!valid) return;
    onCreate({ title: title.trim(), desc: desc.trim() || 'No description', protected: pwOn });
  }

  return (
    <div style={{ border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-lg)', background: 'var(--card)',
      padding: 16, boxShadow: '0 0 0 3px hsl(188 59% 38% / 0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <SMIcon name="plus-circle" size={16} color="var(--primary)" strokeWidth={2.2} />
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--foreground)' }}>New share link</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Title</label>
        <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Acme stakeholder view"
          style={inputBase}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px hsl(188 59% 38% / 0.2)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--input)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>· optional</span></label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="What's this link for, and who is it shared with?"
          style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 2px hsl(188 59% 38% / 0.2)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--input)'; e.target.style.boxShadow = 'none'; }} />
      </div>

      {/* Password protect */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
          <div style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--radius-md)',
            background: 'var(--muted)', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SMIcon name="lock" size={14} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Password protect</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>Require a password to open the link</div>
          </div>
          {/* toggle */}
          <button onClick={() => setPwOn(v => !v)} role="switch" aria-checked={pwOn}
            style={{ width: 40, height: 22, flexShrink: 0, borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
              background: pwOn ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background .15s', padding: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: pwOn ? 20 : 2, width: 18, height: 18, borderRadius: '50%',
              background: '#fff', transition: 'left .15s', boxShadow: 'var(--shadow-sm)' }}></span>
          </button>
        </div>
        {pwOn && (
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)',
              border: '1px solid var(--input)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
              <SMIcon name="key-round" size={14} color="var(--muted-foreground)" strokeWidth={2} />
              <input value={pw} onChange={e => setPw(e.target.value)} type={showPw ? 'text' : 'password'} placeholder="Set a password"
                style={{ flex: 1, fontSize: 13, color: 'var(--foreground)', padding: '8px 0', border: 'none', outline: 'none',
                  background: 'transparent', fontFamily: 'var(--font-sans)' }} />
              <button onClick={() => setShowPw(v => !v)} style={{ border: 'none', background: 'transparent', cursor: 'pointer',
                color: 'var(--muted-foreground)', display: 'flex', padding: 4 }}>
                <SMIcon name={showPw ? 'eye-off' : 'eye'} size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>
          <MiniAvatar member={currentUser} size={20} />
          <span>Sharing as {currentUser.name}</span>
        </div>
        <button onClick={onCancel} style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} disabled={!valid}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, padding: '8px 18px',
            borderRadius: 'var(--radius-md)', border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
            background: 'var(--primary)', color: 'var(--primary-foreground)', opacity: valid ? 1 : 0.45 }}>
          <SMIcon name="link" size={14} strokeWidth={2.2} /> Create link
        </button>
      </div>
    </div>
  );
}

/* ── The modal shell ─────────────────────────────────────────────────── */
function ShareModal({ isAdmin, currentUserId, seedEmpty, onClose }) {
  const currentUser = SM_MEMBERS[currentUserId];
  const [shares, setShares] = React.useState(seedEmpty ? [] : SHARES_INIT);
  const [adding, setAdding] = React.useState(seedEmpty);
  const bodyRef = React.useRef(null);

  // keep shares in sync when seedEmpty tweak flips
  React.useEffect(() => {
    setShares(seedEmpty ? [] : SHARES_INIT);
    setAdding(seedEmpty);
  }, [seedEmpty]);

  React.useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function createShare({ title, desc, protected: prot }) {
    const s = { id: Math.random().toString(36).slice(2), title, desc, protected: prot,
      creatorId: currentUserId, created: 'Today', slug: makeSlug(), views: 0 };
    setShares(prev => [s, ...prev]);
    setAdding(false);
    setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, 0);
  }

  function deleteShare(id) { setShares(prev => prev.filter(s => s.id !== id)); }

  const canDelete = (s) => isAdmin || s.creatorId === currentUserId;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgb(20 28 33 / 0.55)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'sm-fade .15s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(580px, 100%)', maxHeight: '88vh',
        background: 'var(--card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'sm-pop .18s cubic-bezier(.2,.7,.3,1)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px',
          borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--radius-md)',
            background: 'hsl(188 59% 38% / 0.12)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SMIcon name="link" size={19} strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.25 }}>Share this view</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#F29E4C', display: 'inline-block' }}></span>
              Marketing timeline · anyone with a link can view
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, flexShrink: 0, border: 'none', background: 'var(--muted)',
            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--muted-foreground)' }}>
            <SMIcon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Section bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 20px 11px', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Active links
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', background: 'var(--muted)',
            borderRadius: 'var(--radius-full)', padding: '1px 8px', minWidth: 20, textAlign: 'center' }}>{shares.length}</span>
          <div style={{ marginLeft: 'auto' }}>
            {!adding && (
              <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5,
                fontWeight: 600, padding: '6px 13px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                <SMIcon name="plus" size={14} strokeWidth={2.4} /> New share
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', minHeight: 120,
          display: 'flex', flexDirection: 'column', gap: 12 }}>
          {adding && (
            <AddShareForm currentUser={currentUser} onCreate={createShare} onCancel={() => setAdding(false)} />
          )}

          {shares.length === 0 && !adding && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '36px 20px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-lg)', background: 'var(--muted)',
                color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <SMIcon name="link" size={22} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>No share links yet</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)', marginTop: 4, maxWidth: 280 }}>
                Create a link to let people outside your team view this timeline.
              </div>
              <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                fontWeight: 600, padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: 'var(--primary)', color: 'var(--primary-foreground)', marginTop: 16 }}>
                <SMIcon name="plus" size={14} strokeWidth={2.4} /> Create share link
              </button>
            </div>
          )}

          {shares.map(s => (
            <ShareRow key={s.id} share={s} canDelete={canDelete(s)} isOwn={s.creatorId === currentUserId} onDelete={deleteShare} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <SMIcon name={isAdmin ? 'shield-check' : 'user'} size={14} strokeWidth={2} color={isAdmin ? 'var(--primary)' : 'currentColor'} />
            {isAdmin ? 'Admin · you can manage every share' : 'Member · you can manage only your own shares'}
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, padding: '8px 20px',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--card)',
            color: 'var(--foreground)', cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ShareModal });
