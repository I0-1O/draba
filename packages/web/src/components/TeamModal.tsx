/**
 * TeamModal — create / edit a team in a portal-rendered modal.
 *
 * Phase 10.1.1: Settings tab is fully functional; Members tab is a locked
 * placeholder until Phase 10.1.2 ships the member management surface.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Archive, Users } from 'lucide-react';
import { IdentityWidget } from '@/components/identity/IdentityWidget';
import type { Identity } from '@/components/identity/identity-constants';
import { IDENTITY_COLORS } from '@/components/identity/identity-constants';
import { useCreateTeam, useUpdateTeam, useArchiveTeam, useUnarchiveTeam } from '@/hooks/useTeamActivities';
import type { components } from '@draba/shared';

type Team = components['schemas']['Team'];

interface Props {
  mode: 'new' | 'edit';
  team?: Team;
  onClose: () => void;
}

type Tab = 'settings' | 'members';

const DEFAULT_COLOR = IDENTITY_COLORS[0].hex;
const DEFAULT_ICON = '__name_1__';

function resolveIdentity(team?: Team): Identity {
  return {
    color: team?.color ?? DEFAULT_COLOR,
    icon: team?.icon ?? DEFAULT_ICON,
  };
}

// ── Archive confirmation dialog ─────────────────────────────────────────────

interface ArchiveDialogProps {
  teamName: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}

function ArchiveDialog({ teamName, onCancel, onConfirm, busy }: ArchiveDialogProps) {
  return (
    <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: 'rgba(249,115,22,.20)', border: '1.5px solid rgba(249,115,22,.44)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Archive size={22} color="#F97316" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#e6edf3' }}>
        Archive &ldquo;{teamName}&rdquo;?
      </div>
      <div style={{ fontSize: 13, color: '#8b949e', lineHeight: 1.6, maxWidth: 400 }}>
        The team will be hidden from active views. All timelines and activities will be preserved and the team can be restored from the Archived section at any time.
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} disabled={busy} style={cancelBtnStyle}>Cancel</button>
        <button onClick={onConfirm} disabled={busy} style={{
          background: 'rgba(249,115,22,.22)', border: '1px solid rgba(249,115,22,.66)',
          color: '#F97316', fontWeight: 600, fontSize: 13,
          padding: '7px 18px', borderRadius: 7, cursor: 'pointer',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Archiving…' : 'Archive team'}
        </button>
      </div>
    </div>
  );
}

// ── Shared button styles ────────────────────────────────────────────────────

const cancelBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #30363d', color: '#8b949e',
  fontSize: 13, padding: '7px 18px', borderRadius: 7, cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: '#2d333b', border: '1px solid #30363d', borderRadius: 7,
  padding: '8px 12px', color: '#e6edf3', fontSize: 13,
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.4px',
  textTransform: 'uppercase', marginBottom: 6, display: 'block',
};

// ── Main component ──────────────────────────────────────────────────────────

export default function TeamModal({ mode, team, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('settings');
  const [teamSaved, setTeamSaved] = useState(mode === 'edit');
  const [showBanner, setShowBanner] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [identity, setIdentity] = useState<Identity>(resolveIdentity(team));
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [notes, setNotes] = useState(team?.notes ?? '');

  // Saved team id after creation — needed for subsequent edits within the modal.
  const [savedTeamId, setSavedTeamId] = useState(team?.id ?? '');

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const archiveTeam = useArchiveTeam();
  const unarchiveTeam = useUnarchiveTeam();

  const busy = createTeam.isPending || updateTeam.isPending || archiveTeam.isPending || unarchiveTeam.isPending;

  useEffect(() => {
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const patch = {
      name: trimmed,
      description: description.trim() || null,
      notes: notes.trim() || null,
      color: identity.color,
      icon: identity.icon,
    };

    if (mode === 'new' && !teamSaved) {
      createTeam.mutate(patch, {
        onSuccess: (created) => {
          setSavedTeamId(created.id);
          setTeamSaved(true);
          setShowBanner(true);
          bannerTimer.current = setTimeout(() => setShowBanner(false), 3000);
        },
      });
    } else {
      const tid = savedTeamId || team?.id;
      if (!tid) return;
      updateTeam.mutate({ teamId: tid, patch }, { onSuccess: () => { /* noop */ } });
    }
  }

  function handleArchive() {
    const tid = savedTeamId || team?.id;
    if (!tid) return;
    archiveTeam.mutate(tid, { onSuccess: onClose });
  }

  const teamColor = identity.color;
  const isNew = mode === 'new';
  const primaryLabel = teamSaved ? 'Save changes' : 'Create team';

  const membersLocked = !teamSaved;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 580, maxHeight: '90vh', background: '#21262d',
          border: '1px solid #30363d', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid #30363d',
        }}>
          <IdentityWidget identity={identity} name={name} shape="square" onChange={setIdentity} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#484f58', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              {isNew ? 'New team' : 'Edit team'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: name ? '#e6edf3' : '#484f58', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {name || 'Team name…'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Saved banner */}
        {showBanner && (
          <div style={{
            padding: '8px 20px',
            background: `${teamColor}18`,
            borderBottom: `1px solid ${teamColor}44`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 14, color: teamColor }}>✓</span>
            <span style={{ fontSize: 12, color: teamColor }}>Team created — you can now add members.</span>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid #30363d' }}>
          {(['settings', 'members'] as Tab[]).map(t => {
            const isActive = tab === t;
            const locked = t === 'members' && membersLocked;
            return (
              <div key={t} style={{ position: 'relative' }}>
                <button
                  onClick={() => !locked && setTab(t)}
                  title={locked ? 'Save the team first to add members' : undefined}
                  style={{
                    padding: '10px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none',
                    borderBottom: `2px solid ${isActive ? teamColor : 'transparent'}`,
                    color: isActive ? '#e6edf3' : '#8b949e',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    marginBottom: -1, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6,
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                  {t === 'members' && teamSaved && (
                    <span style={{ fontSize: 11, color: '#484f58', background: '#2d333b', borderRadius: 99, padding: '1px 6px' }}>
                      0
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {showArchiveConfirm ? (
            <ArchiveDialog
              teamName={name || 'this team'}
              onCancel={() => setShowArchiveConfirm(false)}
              onConfirm={handleArchive}
              busy={archiveTeam.isPending}
            />
          ) : tab === 'settings' ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Identity field */}
              <div>
                <label style={labelStyle}>Icon &amp; color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IdentityWidget identity={identity} name={name} shape="square" onChange={setIdentity} />
                  <span style={{ fontSize: 12, color: '#484f58' }}>Click to change icon &amp; color</span>
                </div>
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>
                  Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Team name…"
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Short description of this team…"
                  style={inputStyle}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes, context, links…"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              {createTeam.isError && (
                <div style={{ fontSize: 12, color: '#ef4444' }}>
                  {(createTeam.error as Error).message}
                </div>
              )}
              {updateTeam.isError && (
                <div style={{ fontSize: 12, color: '#ef4444' }}>
                  {(updateTeam.error as Error).message}
                </div>
              )}
            </div>
          ) : (
            // Members tab — locked placeholder for Phase 10.1.2
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, color: '#484f58' }}>
              <Users size={32} strokeWidth={1.4} />
              <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                Member management is coming in the next phase. You can add and manage members here once Phase 10.1.2 ships.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid #30363d',
        }}>
          <div>
            {mode === 'edit' && !showArchiveConfirm && (
              <button
                onClick={() => setShowArchiveConfirm(true)}
                style={{
                  background: 'none', border: '1px solid #30363d', color: '#484f58',
                  fontSize: 12, padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                }}
              >
                <Archive size={13} />
                Archive team
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={busy || !name.trim()}
              style={{
                background: teamColor, color: '#fff', fontWeight: 600,
                fontSize: 13, padding: '7px 18px', borderRadius: 7, cursor: 'pointer',
                border: 'none', opacity: (busy || !name.trim()) ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            >
              {busy ? 'Saving…' : primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
