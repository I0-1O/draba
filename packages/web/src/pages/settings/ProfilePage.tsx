/**
 * /settings/profile — Display name, identity (color + icon), and read-only email.
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUpdateProfile } from '@/hooks/useSettings'
import { IdentityWidget } from '@/components/identity/IdentityWidget'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function ProfilePage() {
  const { user } = useAuth()
  const updateProfile = useUpdateProfile()

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

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Profile</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Changes to your name and identity propagate across all your team memberships.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        {/* Identity preview */}
        <div className="flex items-center gap-4 mb-6">
          <Badge identity={identity} name={displayName} size={48} shape="circle" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-foreground">
                {displayName || 'Your Name'}
              </span>
              {user?.isSuperadmin && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary font-semibold tracking-wide">
                  Superadmin
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Identity preview — shown in sidebar and Gantt
            </div>
          </div>
        </div>

        {/* Identity picker */}
        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Color & Icon</Label>
          <IdentityWidget
            identity={identity}
            name={displayName}
            shape="circle"
            onChange={(next) => setIdentity(next)}
          />
        </div>

        {/* Display name */}
        <div className="flex flex-col gap-1.5 mb-4">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="max-w-[360px]"
          />
        </div>

        {/* Email (read-only) */}
        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Email</Label>
          <Input
            value={user?.email ?? ''}
            disabled
            className="max-w-[360px] opacity-60"
          />
          <p className="text-xs text-muted-foreground m-0">
            Email changes are not yet supported.
          </p>
        </div>

        {feedback && (
          <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
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
