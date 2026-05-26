/**
 * /settings/security — Change password form.
 */

import { useState } from 'react'
import { useChangePassword } from '@/hooks/useSettings'
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

export default function SecurityPage() {
  const changePassword = useChangePassword()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const mismatch = next !== confirm && confirm !== ''
  const tooShort = next.length > 0 && next.length < 8
  const canSave = current !== '' && next.length >= 8 && next === confirm

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setFeedback(null)
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next })
      setFeedback({ type: 'success', msg: 'Password updated successfully.' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      const msg =
        code === 'WRONG_PASSWORD'
          ? 'Current password is incorrect.'
          : err instanceof ApiError
          ? err.message
          : 'Failed to change password.'
      setFeedback({ type: 'error', msg })
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Security</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Update your password. You'll need to enter your current password to confirm the change.
      </p>

      <div style={sectionStyle}>
        <form onSubmit={handleSubmit}>
          <div style={fieldStyle}>
            <Label htmlFor="currentPw" style={{ color: '#e6edf3' }}>Current password</Label>
            <Input
              id="currentPw"
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
              style={{ maxWidth: 360 }}
            />
          </div>

          <div style={fieldStyle}>
            <Label htmlFor="newPw" style={{ color: '#e6edf3' }}>New password</Label>
            <Input
              id="newPw"
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
              style={{ maxWidth: 360, borderColor: tooShort ? '#f85149' : undefined }}
            />
            {tooShort && (
              <p style={{ fontSize: 12, color: '#f85149', margin: 0 }}>
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          <div style={fieldStyle}>
            <Label htmlFor="confirmPw" style={{ color: '#e6edf3' }}>Confirm new password</Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              style={{ maxWidth: 360, borderColor: mismatch ? '#f85149' : undefined }}
            />
            {mismatch && (
              <p style={{ fontSize: 12, color: '#f85149', margin: 0 }}>Passwords don't match.</p>
            )}
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

          <Button type="submit" disabled={!canSave || changePassword.isPending}>
            {changePassword.isPending ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
