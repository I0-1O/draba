/**
 * TeamModal — create / edit a team in a portal-rendered modal.
 *
 * The Members tab is fully functional after Phase 10.1.2. The Settings tab
 * handles team identity and metadata. Identity and name live in the modal
 * header so they remain visible while the user scrolls the tab body.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Archive, Mail, Link2, Copy, Check, Plus, Minus, RefreshCw, UserMinus, RotateCcw } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { IdentityWidget } from '@/components/identity/IdentityWidget';
import { Badge } from '@/components/identity/Badge';
import type { Identity } from '@/components/identity/identity-constants';
import { IDENTITY_COLORS } from '@/components/identity/identity-constants';
import { useCreateTeam, useUpdateTeam, useArchiveTeam, useUnarchiveTeam, useTeamMembers } from '@/hooks/useTeamActivities';
import StatusTemplatesTab from '@/components/StatusTemplatesTab';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTeamInvites, useRevokeInvite,
  useTeamInviteLink, useCreateInviteLink, useRevokeInviteLink,
  useAddMember, useDeleteMember, useArchiveMember, useUnarchiveMember,
  useCreateParticipant, useUpdateMember, useUserSearch,
} from '@/hooks/useMemberManagement';
import RoleDropdown, { type MemberRole } from '@/components/RoleDropdown';
import InlineEditableTitle from '@/components/shared/InlineEditableTitle';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { components } from '@draba/shared';

type Team = components['schemas']['Team'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

interface Props {
  mode: 'new' | 'edit';
  team?: Team;
  onClose: () => void;
  /** Called with the newly created team immediately after server confirmation. */
  onTeamCreated?: (team: Team) => void;
  /** Whether the current user is a team admin. */
  isAdmin?: boolean;
}

type Tab = 'settings' | 'members' | 'statuses';

const DEFAULT_COLOR = IDENTITY_COLORS[0].hex;
const DEFAULT_ICON = '__name_1__';

function resolveIdentity(team?: Team): Identity {
  return {
    color: team?.color ?? DEFAULT_COLOR,
    icon: team?.icon ?? DEFAULT_ICON,
  };
}

// ── Shared button styles ────────────────────────────────────────────────────

const cancelBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', color: 'var(--muted-foreground)',
  fontSize: 13, padding: '7px 18px', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '8px 12px', color: 'var(--foreground)', fontSize: 13,
  width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-sans)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.4px',
  textTransform: 'uppercase', marginBottom: 6, display: 'block',
};

const archiveBtnStyle: React.CSSProperties = {
  fontSize: 12, color: '#F59E0B', background: 'rgba(245,158,11,0.12)',
  border: '1px solid rgba(245,158,11,0.35)', borderRadius: 7,
  padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  display: 'flex', alignItems: 'center', gap: 6,
};

const restoreBtnStyle: React.CSSProperties = {
  fontSize: 12, color: '#1A97A2', background: 'rgba(26,151,162,0.12)',
  border: '1px solid rgba(26,151,162,0.35)', borderRadius: 7,
  padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
  display: 'flex', alignItems: 'center', gap: 6,
};

// ── Main component ──────────────────────────────────────────────────────────

export default function TeamModal({ mode, team, onClose, onTeamCreated, isAdmin = true }: Props) {
  const { user } = useAuth()
  const currentUserId = (user as { id?: string } | null)?.id ?? ''
  const [tab, setTab] = useState<Tab>('settings');
  const [teamSaved, setTeamSaved] = useState(mode === 'edit');
  const [showBanner, setShowBanner] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [identity, setIdentity] = useState<Identity>(resolveIdentity(team));
  const [name, setName] = useState(team?.name ?? '');
  const [description, setDescription] = useState(team?.description ?? '');
  const [notes, setNotes] = useState(team?.notes ?? '');

  const [savedTeamId, setSavedTeamId] = useState(team?.id ?? '');

  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const archiveTeam = useArchiveTeam();
  const unarchiveTeam = useUnarchiveTeam();

  // Members tab state — only loaded when the team exists.
  const activeTeamId = savedTeamId || team?.id || '';
  const { data: members = [] } = useTeamMembers(activeTeamId);
  const { data: invites = [] } = useTeamInvites(activeTeamId);
  const { data: inviteLink } = useTeamInviteLink(activeTeamId);
  const addMember = useAddMember(activeTeamId);
  const deleteMember = useDeleteMember(activeTeamId);
  const archiveMember = useArchiveMember(activeTeamId);
  const unarchiveMember = useUnarchiveMember(activeTeamId);
  const createParticipant = useCreateParticipant(activeTeamId);
  const updateMember = useUpdateMember(activeTeamId);
  const revokeInvite = useRevokeInvite(activeTeamId);
  const createInviteLink = useCreateInviteLink(activeTeamId);
  const revokeInviteLink = useRevokeInviteLink(activeTeamId);

  const [searchQ, setSearchQ] = useState('');
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  // Maps memberId → assignmentCount when a 409 MEMBER_HAS_ASSIGNMENTS is returned.
  const [removeErrors, setRemoveErrors] = useState<Record<string, number>>({});
  const [participantName, setParticipantName] = useState('');
  const [participantIdentity, setParticipantIdentity] = useState<Identity>({ color: IDENTITY_COLORS[3].hex, icon: '__name_1__' });
  const [copyLinkLabel, setCopyLinkLabel] = useState<'copy' | 'copied'>('copy');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchResults = [] } = useUserSearch(searchQ);

  const isArchived = Boolean(team?.archivedAt);
  const busy = createTeam.isPending || updateTeam.isPending || archiveTeam.isPending || unarchiveTeam.isPending;

  useEffect(() => {
    return () => { if (bannerTimer.current) clearTimeout(bannerTimer.current); };
  }, []);

  // Stale 409 errors belong to a specific member row; clear them when the
  // search changes because the member list may reorder or filter differently.
  useEffect(() => {
    setRemoveErrors({});
  }, [searchQ]);

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
          onTeamCreated?.(created);
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

  function handleRestore() {
    const tid = savedTeamId || team?.id;
    if (!tid) return;
    unarchiveTeam.mutate(tid, { onSuccess: onClose });
  }

  const teamColor = identity.color;
  const isNew = mode === 'new';
  const primaryLabel = teamSaved ? 'Save changes' : 'Create team';
  const membersLocked = !teamSaved;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: 580, maxHeight: '90vh', background: 'var(--card)',
          border: '1px solid var(--border)', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header — identity widget + editable name */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <IdentityWidget identity={identity} name={name} shape="square" onChange={setIdentity} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 3 }}>
              {isNew ? 'New team' : 'Edit team'}
            </div>
            <InlineEditableTitle
              value={name}
              onChange={setName}
              placeholder="Team name…"
              autoFocus={mode === 'new'}
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4, display: 'flex' }}>
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
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
          {(['settings', 'members', 'statuses'] as Tab[]).map(t => {
            const isActive = tab === t;
            const locked = (t === 'members' || t === 'statuses') && membersLocked;
            return (
              <div key={t} style={{ position: 'relative' }}>
                <button
                  onClick={() => !locked && setTab(t)}
                  title={locked ? 'Save the team first to add members' : undefined}
                  style={{
                    padding: '10px 14px', fontSize: 13, fontWeight: 500, background: 'none', border: 'none',
                    borderBottom: `2px solid ${isActive ? teamColor : 'transparent'}`,
                    color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.45 : 1,
                    marginBottom: -1, fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    textTransform: 'capitalize',
                  }}
                >
                  {t === 'statuses' ? 'Status Templates' : t}
                  {t === 'members' && teamSaved && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 99, padding: '1px 6px' }}>
                      {members.length}
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
            <ConfirmDialog
              variant="amber"
              icon={<Archive size={22} color="#F59E0B" />}
              title={`Archive "${name || 'this team'}"?`}
              body="The team will be hidden from active views. All timelines and activities will be preserved and the team can be restored from the Archived section at any time."
              confirmLabel="Archive team"
              busy={archiveTeam.isPending}
              onCancel={() => setShowArchiveConfirm(false)}
              onConfirm={handleArchive}
            />
          ) : tab === 'settings' ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Description */}
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  autoFocus={mode === 'edit'}
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
                <div style={{ fontSize: 12, color: 'var(--destructive)' }}>
                  Something went wrong — refer to logs for details.
                </div>
              )}
              {updateTeam.isError && (
                <div style={{ fontSize: 12, color: 'var(--destructive)' }}>
                  Something went wrong — refer to logs for details.
                </div>
              )}
            </div>
          ) : tab === 'statuses' ? (
            <StatusTemplatesTab
              teamId={activeTeamId}
              isAdmin={isAdmin}
              teamColor={teamColor}
            />
          ) : (
            // Members tab
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Search / add input */}
              {isAdmin && (
                <div>
                  <label style={labelStyle}>Add member or invite by email</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={searchQ}
                      onChange={e => setSearchQ(e.target.value)}
                      placeholder="Search by name or email…"
                      style={{ ...inputStyle, paddingRight: 36 }}
                    />
                    {searchQ && (
                      <button
                        onClick={() => setSearchQ('')}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 2 }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Search results */}
                  {searchQ.length >= 2 && (
                    <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, overflow: 'hidden' }}>
                      {searchResults.length === 0 ? (
                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No users found for "{searchQ}"</span>
                          <button
                            onClick={() => {
                              // Trigger email invite
                              const email = searchQ.includes('@') ? searchQ : null;
                              if (!email) return;
                              fetch(`/teams/${activeTeamId}/invites`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
                                body: JSON.stringify({ email }),
                              }).then(() => setSearchQ(''));
                            }}
                            style={{ fontSize: 11, color: '#1A97A2', background: 'rgba(26,151,162,0.12)', border: '1px solid rgba(26,151,162,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                          >
                            <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />
                            Invite
                          </button>
                        </div>
                      ) : (
                        searchResults.map(u => {
                          const alreadyMember = members.some(m => m.userId === u.id);
                          return (
                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                              <Badge identity={{ color: '#8b949e', icon: '__name_1__' }} name={u.displayName} shape="circle" size={22} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: 'var(--foreground)' }}>{u.displayName}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{u.email}</div>
                              </div>
                              {alreadyMember ? (
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Already added</span>
                              ) : (
                                <button
                                  onClick={() => addMember.mutate({ userId: u.id }, { onSuccess: () => setSearchQ('') })}
                                  style={{ fontSize: 11, color: '#1A97A2', background: 'rgba(26,151,162,0.12)', border: '1px solid rgba(26,151,162,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Plus size={11} />
                                  Add
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Participant creation form */}
              {isAdmin && (
                <div>
                  {!showParticipantForm ? (
                    <button
                      onClick={() => setShowParticipantForm(true)}
                      style={{ fontSize: 12, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Plus size={12} />
                      Add participant (no login)
                    </button>
                  ) : (
                    <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                      <label style={labelStyle}>New participant</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <IdentityWidget
                          identity={participantIdentity}
                          name={participantName}
                          shape="circle"
                          onChange={setParticipantIdentity}
                        />
                        <input
                          value={participantName}
                          onChange={e => setParticipantName(e.target.value)}
                          placeholder="Display name (required)…"
                          style={{ ...inputStyle, flex: 1 }}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            if (!participantName.trim()) return;
                            createParticipant.mutate({
                              name: participantName.trim(),
                              color: participantIdentity.color,
                              icon: participantIdentity.icon,
                            }, {
                              onSuccess: () => { setParticipantName(''); setShowParticipantForm(false); },
                            });
                          }}
                          disabled={!participantName.trim() || createParticipant.isPending}
                          style={{ background: '#F59E0B', color: '#000', fontWeight: 600, fontSize: 12, padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0, opacity: !participantName.trim() ? 0.5 : 1 }}
                        >
                          Create
                        </button>
                        <button onClick={() => setShowParticipantForm(false)} style={{ ...cancelBtnStyle, padding: '7px 10px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Role-change error banner */}
              {updateMember.isError && (
                <div style={{ fontSize: 12, color: '#F59E0B', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 7, padding: '7px 12px' }}>
                  {(updateMember.error as { message?: string })?.message ?? 'Could not update role.'}
                </div>
              )}

              {/* Member list */}
              <div>
                <label style={labelStyle}>Members ({members.length})</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {members.map((m: TeamMemberWithUser) => {
                    const isParticipant = !m.userId;
                    const isInactive = Boolean(m.archivedAt);
                    const memberRole: MemberRole = isParticipant ? 'participant' : (m.role as MemberRole);
                    const removeError = removeErrors[m.id];
                    return (
                      <div key={m.id}>
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 10px', borderRadius: 7,
                            background: isInactive ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)',
                            opacity: isInactive ? 0.5 : 1,
                          }}
                        >
                          <div style={{ flexShrink: 0, border: isParticipant ? '1.5px dashed var(--muted-foreground)' : 'none', borderRadius: '50%' }}>
                            <Badge
                              identity={{ color: m.color ?? '#8b949e', icon: m.icon ?? '__name_words__' }}
                              name={m.displayName}
                              shape="circle"
                              size={24}
                            />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName}</span>
                              {isParticipant && <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', color: '#F59E0B', borderRadius: 99, padding: '0px 5px', flexShrink: 0 }}>No login</span>}
                            </div>
                            {!isParticipant && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>}
                          </div>
                          {isAdmin && (
                            <RoleDropdown
                              value={memberRole}
                              onChange={role => {
                                if (isParticipant || role === 'participant') return;
                                updateMember.mutate({ memberId: m.id, patch: { role: role as 'admin' | 'member' } });
                              }}
                              disabled={isParticipant || m.userId === currentUserId}
                              hideParticipant={!isParticipant}
                            />
                          )}
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {isInactive ? (
                                <button
                                  title="Reactivate member"
                                  onClick={() => unarchiveMember.mutate(m.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 3, display: 'flex' }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#1A97A2')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                                >
                                  <RefreshCw size={13} />
                                </button>
                              ) : (
                                <button
                                  title="Inactivate member"
                                  onClick={() => archiveMember.mutate(m.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 3, display: 'flex' }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#F59E0B')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                                >
                                  <UserMinus size={13} />
                                </button>
                              )}
                              <button
                                title="Remove from team"
                                onClick={() => {
                                  setRemoveErrors(prev => { const next = { ...prev }; delete next[m.id]; return next; });
                                  deleteMember.mutate(m.id, {
                                    onError: (err) => {
                                      if (err instanceof ApiError && err.code === 'MEMBER_HAS_ASSIGNMENTS') {
                                        const count = (err.data?.assignmentCount as number) ?? 0;
                                        setRemoveErrors(prev => ({ ...prev, [m.id]: count }));
                                      }
                                    },
                                  });
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 3, display: 'flex' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                              >
                                <Minus size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                        {removeError !== undefined && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#F59E0B', padding: '4px 10px 4px 44px' }}>
                            <span>{removeError} assignment{removeError === 1 ? '' : 's'} — can't remove.</span>
                            <button
                              onClick={() => {
                                archiveMember.mutate(m.id, {
                                  onSuccess: () => setRemoveErrors(prev => { const next = { ...prev }; delete next[m.id]; return next; }),
                                });
                              }}
                              style={{ fontSize: 12, color: '#F59E0B', background: 'none', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                            >
                              Inactivate instead
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pending invitations */}
              {isAdmin && invites.length > 0 && (
                <div>
                  <label style={labelStyle}>Pending invitations ({invites.length})</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {invites.map(inv => (
                      <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Mail size={11} color="var(--muted-foreground)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.email}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                            Sent {new Date(inv.createdAt).toLocaleDateString()} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          onClick={() => revokeInvite.mutate(inv.id)}
                          style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite link */}
              {isAdmin && (
                <div>
                  <label style={labelStyle}>
                    <Link2 size={11} style={{ display: 'inline', marginRight: 5 }} />
                    Invite link
                  </label>
                  {inviteLink?.token ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          readOnly
                          value={`${window.location.origin}/register?token=${inviteLink.token}`}
                          style={{ ...inputStyle, color: 'var(--muted-foreground)', flex: 1 }}
                          onClick={e => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/register?token=${inviteLink.token!}`);
                            setCopyLinkLabel('copied');
                            if (copyTimer.current) clearTimeout(copyTimer.current);
                            copyTimer.current = setTimeout(() => setCopyLinkLabel('copy'), 2000);
                          }}
                          style={{
                            background: copyLinkLabel === 'copied' ? 'rgba(26,151,162,0.12)' : 'var(--muted)',
                            border: `1px solid ${copyLinkLabel === 'copied' ? 'rgba(26,151,162,0.35)' : 'var(--border)'}`,
                            color: copyLinkLabel === 'copied' ? '#1A97A2' : 'var(--muted-foreground)',
                            borderRadius: 7, padding: '0 14px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'var(--font-sans)',
                            transition: 'all 0.15s', flexShrink: 0,
                          }}
                        >
                          {copyLinkLabel === 'copied' ? <Check size={12} /> : <Copy size={12} />}
                          {copyLinkLabel === 'copied' ? 'Copied!' : 'Copy link'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flex: 1, lineHeight: 1.5 }}>
                          Anyone with this link can join the team as a member.
                        </span>
                        <button
                          onClick={() => createInviteLink.mutate()}
                          style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
                        >
                          <RefreshCw size={11} /> Regenerate
                        </button>
                        <button
                          onClick={() => revokeInviteLink.mutate()}
                          style={{ fontSize: 11, color: '#EF4444', background: 'none', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No invite link — generate one to share a reusable join URL.</span>
                      <button
                        onClick={() => createInviteLink.mutate()}
                        style={{ fontSize: 12, color: '#1A97A2', background: 'rgba(26,151,162,0.12)', border: '1px solid rgba(26,151,162,0.35)', borderRadius: 7, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
                      >
                        Generate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — hidden when archive confirm is showing */}
        {!showArchiveConfirm && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 20px', borderTop: '1px solid var(--border)',
          }}>
            <div>
              {mode === 'edit' && (
                isArchived ? (
                  <button
                    onClick={handleRestore}
                    disabled={busy}
                    style={{ ...restoreBtnStyle, opacity: busy ? 0.6 : 1 }}
                  >
                    <RotateCcw size={13} />
                    Restore team
                  </button>
                ) : (
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    style={archiveBtnStyle}
                  >
                    <Archive size={13} />
                    Archive team
                  </button>
                )
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
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {busy ? 'Saving…' : primaryLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
