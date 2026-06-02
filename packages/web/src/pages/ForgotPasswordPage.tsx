/**
 * /forgot-password — Public page for requesting a password reset email.
 * When SMTP is not configured the API returns a hint; the page shows a
 * "contact admin" message instead of the form.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPassword } from '@/hooks/useSettings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await forgotPassword.mutateAsync(email.trim().toLowerCase())
    setSubmitted(true)
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
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            {submitted
              ? 'Check your email.'
              : "Enter your email and we'll send you a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 16 }}>
                If an account exists for that email address, a password reset link has been sent.
                Check your inbox and spam folder.
              </p>
              <Link to="/login" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 600 }}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <Button type="submit" disabled={forgotPassword.isPending || !email.trim()}>
                {forgotPassword.isPending ? 'Sending…' : 'Send reset link'}
              </Button>

              <p style={{ fontSize: 13, textAlign: 'center', color: 'var(--muted-foreground)' }}>
                <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
