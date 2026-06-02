import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import DarkModeToggle from '@/components/DarkModeToggle'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  // Pre-fill from ?token= query param (invite link).
  const [inviteToken, setInviteToken] = useState(searchParams.get('token') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(email, password, displayName, inviteToken || undefined)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--background)',
        padding: '24px',
      }}
    >
      {/* Dark mode toggle — top-right */}
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <DarkModeToggle />
      </div>

      {/* Logo + wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <img src="/logo-teal.svg" alt="draba" style={{ width: 36, height: 36 }} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
          draba
        </span>
      </div>

      <Card style={{ width: '100%', maxWidth: 400 }}>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>You need a valid invite token to register.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                type="text"
                autoComplete="name"
                placeholder="Jane Smith"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label htmlFor="inviteToken">Invite token</Label>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted-foreground)',
                  background: 'var(--muted)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  lineHeight: 1.5,
                }}
              >
                draba is invite-only. Ask your team admin to send you an invite, or click the link in your invitation email — it will fill this in automatically.
              </div>
              <Input
                id="inviteToken"
                type="text"
                placeholder="Paste your invite token"
                value={inviteToken}
                onChange={e => setInviteToken(e.target.value)}
              />
            </div>

            {error && (
              <p style={{ fontSize: 13, color: 'var(--destructive)', margin: 0 }}>{error}</p>
            )}

            <Button type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p style={{ marginTop: 16, fontSize: 13, textAlign: 'center', color: 'var(--muted-foreground)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
