/**
 * /reset-password?token=... — Public page for completing a password reset.
 * Reads the token from the URL query string, sends it with the new password,
 * and redirects to /login on success.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useResetPassword } from '@/hooks/useSettings'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const resetPassword = useResetPassword()

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirmPw !== '' && newPw !== confirmPw
  const tooShort = newPw.length > 0 && newPw.length < 8
  const canSubmit = token !== '' && newPw.length >= 8 && newPw === confirmPw

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await resetPassword.mutateAsync({ token, newPassword: newPw })
      navigate('/login', { state: { message: 'Password reset — you can now sign in.' } })
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      if (code === 'TOKEN_INVALID' || code === 'TOKEN_EXPIRED') {
        setError('This reset link has expired or already been used. Request a new one.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to reset password.')
      }
    }
  }

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--background)', padding: 24,
      }}>
        <Card style={{ width: '100%', maxWidth: 380 }}>
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>This reset link is missing a token.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/forgot-password" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
              Request a new reset link
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--background)', padding: 24,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 24 }}>
        <img src="/logo-teal.svg" alt="draba" style={{ width: 72, height: 72 }} />
        <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>
          draba
        </span>
      </div>

      <Card style={{ width: '100%', maxWidth: 380 }}>
        <CardHeader>
          <CardTitle>Set new password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="newPw">New password</Label>
              <Input
                id="newPw"
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
              />
              {tooShort && (
                <p style={{ fontSize: 12, color: 'var(--destructive)', margin: 0 }}>
                  Password must be at least 8 characters.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="confirmPw">Confirm new password</Label>
              <Input
                id="confirmPw"
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              {mismatch && (
                <p style={{ fontSize: 12, color: 'var(--destructive)', margin: 0 }}>Passwords don't match.</p>
              )}
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--destructive)', margin: 0 }}>{error}</p>
            )}

            <Button type="submit" disabled={!canSubmit || resetPassword.isPending}>
              {resetPassword.isPending ? 'Resetting…' : 'Set new password'}
            </Button>

            <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted-foreground)' }}>
              <Link to="/forgot-password" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                Request a new link
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
