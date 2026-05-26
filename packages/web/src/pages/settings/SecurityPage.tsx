/**
 * /settings/security — Change password form.
 */

import { useState } from 'react'
import { useChangePassword } from '@/hooks/useSettings'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Security</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Update your password. You'll need to enter your current password to confirm the change.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5 mb-4">
            <Label htmlFor="currentPw">Current password</Label>
            <Input
              id="currentPw"
              type="password"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="max-w-[360px]"
            />
          </div>

          <div className="flex flex-col gap-1.5 mb-4">
            <Label htmlFor="newPw">New password</Label>
            <Input
              id="newPw"
              type="password"
              value={next}
              onChange={e => setNext(e.target.value)}
              autoComplete="new-password"
              className={`max-w-[360px]${tooShort ? ' border-destructive' : ''}`}
            />
            {tooShort && (
              <p className="text-xs text-destructive m-0">
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 mb-4">
            <Label htmlFor="confirmPw">Confirm new password</Label>
            <Input
              id="confirmPw"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={`max-w-[360px]${mismatch ? ' border-destructive' : ''}`}
            />
            {mismatch && (
              <p className="text-xs text-destructive m-0">Passwords don't match.</p>
            )}
          </div>

          {feedback && (
            <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
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
