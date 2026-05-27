/**
 * /settings/profile — Identity, display name, and stats for the current user.
 */

import { useState, useEffect } from 'react'
import { Calendar, Activity } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useUpdateProfile, useMyStats } from '@/hooks/useSettings'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Stat chip ──────────────────────────────────────────────────────────────

function StatChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '10px 14px', borderRadius: 8, flex: 1, minWidth: 0,
      border: `1px solid ${color}44`, borderTop: `3px solid ${color}`,
      background: `${color}0a`, textAlign: 'center',
    }}>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()
  const { data: stats } = useMyStats()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [identity, setIdentity] = useState<Identity>({
    color: user?.color ?? '#288C9B',
    icon: user?.icon ?? '__none__',
  })
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
      setIdentity({ color: user.color ?? '#288C9B', icon: user.icon ?? '__none__' })
    }
  }, [user])

  async function handleSave() {
    setFeedback(null)
    try {
      await updateProfile.mutateAsync({ displayName, color: identity.color, icon: identity.icon })
      setFeedback({ type: 'success', msg: 'Profile updated.' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update profile.'
      setFeedback({ type: 'error', msg })
    }
  }

  const accentColor = identity.color

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Profile</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Changes to your name and identity propagate across all your team memberships.
      </p>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-5">
        {/* Header banner — identity + name (mirrors MemberModal / TeamModal pattern) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flexShrink: 0 }}>
            <IdentityWidget
              identity={identity}
              name={displayName}
              shape="circle"
              onChange={next => setIdentity(next)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.4px] mb-1">
              Your profile
              {user?.isSuperadmin && (
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary font-semibold tracking-wide normal-case">
                  Superadmin
                </span>
              )}
            </div>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              style={{
                fontSize: 18, fontWeight: 600, color: 'var(--foreground)',
                background: 'transparent', border: 'none', outline: 'none',
                padding: '1px 4px', margin: '-1px -4px',
                borderRadius: 4, fontFamily: 'inherit', width: '100%',
              }}
              onFocus={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.outline = `2px solid ${accentColor}44` }}
              onBlur={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.outline = 'none' }}
            />
            <div className="text-xs text-muted-foreground mt-0.5">{user?.email ?? ''}</div>
          </div>
          {/* Live badge preview */}
          <div style={{ flexShrink: 0 }}>
            <Badge identity={identity} name={displayName} size={44} shape="circle" />
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.4px] mb-2 flex items-center gap-1.5">
              <Calendar size={11} /> Timelines
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <StatChip value={stats.activeTimelines} label="Active" color="#1A97A2" />
              <StatChip value={stats.archivedTimelines} label="Archived" color="#484f58" />
            </div>

            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.4px] mb-2 flex items-center gap-1.5">
              <Activity size={11} /> Activities
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StatChip value={stats.pastDue} label="Past due" color={stats.pastDue > 0 ? '#EF4444' : '#484f58'} />
              <StatChip value={stats.running} label="Running" color="#1A97A2" />
              <StatChip value={stats.upcoming} label="Upcoming" color="#3B82F6" />
              <StatChip value={stats.archivedActivities} label="Archived" color="#484f58" />
            </div>
          </div>
        )}

        {/* Fields */}
        <div style={{ padding: '20px 24px' }}>
          {/* Email (read-only) */}
          <div className="flex flex-col gap-1.5 mb-5">
            <Label>Email</Label>
            <Input
              value={user?.email ?? ''}
              disabled
              className="max-w-[360px] opacity-60"
            />
            <p className="text-xs text-muted-foreground m-0">Email changes are not yet supported.</p>
          </div>

          {feedback && (
            <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
              {feedback.msg}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={updateProfile.isPending || !displayName.trim()}
            style={{
              background: accentColor,
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              padding: '8px 20px',
              borderRadius: 7,
              border: 'none',
              cursor: updateProfile.isPending || !displayName.trim() ? 'not-allowed' : 'pointer',
              opacity: updateProfile.isPending || !displayName.trim() ? 0.5 : 1,
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
            }}
          >
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
