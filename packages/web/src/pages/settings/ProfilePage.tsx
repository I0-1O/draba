/**
 * /settings/profile — Display name, identity (color + icon), and read-only email.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUpdateProfile } from '@/hooks/useSettings'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

const sectionStyle: React.CSSProperties = {
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 20,
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginBottom: 16,
}

export default function ProfilePage() {
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [color, setColor] = useState<string | null>(user?.color ?? null)
  const [icon, setIcon] = useState<string | null>(user?.icon ?? null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName)
      setColor(user.color ?? null)
      setIcon(user.icon ?? null)
    }
  }, [user])

  async function handleSave() {
    setFeedback(null)
    try {
      await updateProfile.mutateAsync({ displayName, color, icon })
      setFeedback({ type: 'success', msg: 'Profile updated.' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update profile.'
      setFeedback({ type: 'error', msg })
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Profile</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Changes to your name and identity propagate across all your team memberships.
      </p>

      <div style={sectionStyle}>
        {/* Identity preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <Badge color={color ?? undefined} icon={icon ?? undefined} size={48} shape="circle" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e6edf3' }}>
              {displayName || 'Your Name'}
            </div>
            <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>
              Identity preview — shown in sidebar and Gantt
            </div>
          </div>
        </div>

        {/* Identity picker */}
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Color & Icon</Label>
          <IdentityWidget
            color={color ?? undefined}
            icon={icon ?? undefined}
            shape="circle"
            onChange={(c, i) => { setColor(c ?? null); setIcon(i ?? null) }}
          />
        </div>

        {/* Display name */}
        <div style={fieldStyle}>
          <Label htmlFor="displayName" style={{ color: '#e6edf3' }}>Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            style={{ maxWidth: 360 }}
          />
        </div>

        {/* Email (read-only) */}
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Email</Label>
          <Input
            value={user?.email ?? ''}
            disabled
            style={{ maxWidth: 360, opacity: 0.6 }}
          />
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
            Email changes are not yet supported.
          </p>
        </div>

        {feedback && (
          <p style={{
            fontSize: 13,
            color: feedback.type === 'success' ? '#3fb950' : '#f85149',
            marginBottom: 12,
          }}>
            {feedback.msg}
          </p>
        )}

        <Button
          onClick={handleSave}
          disabled={updateProfile.isPending || !displayName.trim()}
        >
          {updateProfile.isPending ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  )
}
