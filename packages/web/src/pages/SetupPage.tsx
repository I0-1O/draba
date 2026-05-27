/**
 * First-run setup wizard. Shown once when no users exist.
 * Collects account, team, and timeline details then creates all three on Finish.
 */

import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { API_BASE, apiFetch, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import DarkModeToggle from '@/components/DarkModeToggle'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3

interface WizardData {
  displayName: string
  email: string
  password: string
  teamName: string
  timelineName: string
  startDate: string
  endDate: string
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<Step, string> = {
  1: 'Account',
  2: 'Team',
  3: 'Timeline',
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = [1, 2, 3]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: 32,
      }}
    >
      {steps.map((n, i) => {
        const done = n < current
        const active = n === current
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    done || active ? 'var(--primary)' : 'transparent',
                  border:
                    done || active
                      ? 'none'
                      : '2px solid var(--border)',
                  color:
                    done || active
                      ? 'var(--primary-foreground)'
                      : 'var(--muted-foreground)',
                  fontSize: 13,
                  fontWeight: 700,
                  transition: 'background 0.2s',
                }}
              >
                {done ? '✓' : n}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? 'var(--foreground)'
                    : 'var(--muted-foreground)',
                }}
              >
                {STEP_LABELS[n]}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  // Shift up to align with the circle, not the label
                  marginBottom: 20,
                  background: done ? 'var(--primary)' : 'var(--border)',
                  transition: 'background 0.2s',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step content
// ---------------------------------------------------------------------------

interface StepProps {
  data: WizardData
  onChange: (patch: Partial<WizardData>) => void
}

function Step1({ data, onChange }: StepProps) {
  return (
    <>
      <CardHeader>
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--primary)',
            margin: '0 0 4px',
          }}
        >
          Welcome to draba!
        </p>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          You're the first person here, so this account will have full admin
          access — you'll be able to create teams, invite users, and manage the
          workspace.
        </CardDescription>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="displayName">Your name</Label>
          <Input
            id="displayName"
            placeholder="Jane Smith"
            autoComplete="name"
            value={data.displayName}
            onChange={e => onChange({ displayName: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={data.email}
            onChange={e => onChange({ email: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={data.password}
            onChange={e => onChange({ password: e.target.value })}
          />
        </div>
      </CardContent>
    </>
  )
}

function Step2({ data, onChange }: StepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Name your team</CardTitle>
        <CardDescription>
          A team is your shared workspace. Everyone you invite will work within
          it, and all your timelines and events live inside one. You can
          customize and add members after setup.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="teamName">Team name</Label>
          <Input
            id="teamName"
            placeholder="Product Marketing"
            autoComplete="off"
            value={data.teamName}
            onChange={e => onChange({ teamName: e.target.value })}
          />
        </div>
      </CardContent>
    </>
  )
}

function Step3({ data, onChange }: StepProps) {
  return (
    <>
      <CardHeader>
        <CardTitle>Your first timeline</CardTitle>
        <CardDescription>
          A timeline is a named date window over your team's events — it's how
          you see who's working on what, and when. Pick a range that fits your
          next planning horizon.
        </CardDescription>
      </CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label htmlFor="timelineName">Timeline name</Label>
          <Input
            id="timelineName"
            placeholder="Q3 Roadmap"
            autoComplete="off"
            value={data.timelineName}
            onChange={e => onChange({ timelineName: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={data.startDate}
              onChange={e => onChange({ startDate: e.target.value })}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="endDate">End date</Label>
            <Input
              id="endDate"
              type="date"
              value={data.endDate}
              onChange={e => onChange({ endDate: e.target.value })}
            />
          </div>
        </div>
      </CardContent>
    </>
  )
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateStep(step: Step, data: WizardData): string | null {
  if (step === 1) {
    if (!data.displayName.trim()) return 'Please enter your name.'
    if (!data.email.trim()) return 'Please enter your email.'
    if (data.password.length < 8) return 'Password must be at least 8 characters.'
    if (/\s/.test(data.password)) return 'Password must not contain spaces.'
  }
  if (step === 2) {
    if (!data.teamName.trim()) return 'Please enter a team name.'
  }
  if (step === 3) {
    if (!data.timelineName.trim()) return 'Please enter a timeline name.'
    if (!data.startDate) return 'Please choose a start date.'
    if (!data.endDate) return 'Please choose an end date.'
    if (data.endDate < data.startDate) return 'End date must be on or after the start date.'
  }
  return null
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

function defaultDates(): { startDate: string; endDate: string } {
  const start = new Date()
  const end = new Date()
  end.setMonth(end.getMonth() + 3)
  return { startDate: toDateString(start), endDate: toDateString(end) }
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

interface SetupStatus {
  needsSetup: boolean
}

export default function SetupPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // If setup has already been completed redirect to login rather than showing
  // a broken wizard (handles back-navigation and direct URL access after setup).
  const { data: setupStatus, isLoading: statusLoading } = useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: () =>
      fetch(`${API_BASE}/setup/status`).then(r => r.json()) as Promise<SetupStatus>,
    staleTime: Infinity,
  })

  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<WizardData>({
    displayName: '',
    email: '',
    password: '',
    teamName: '',
    timelineName: '',
    ...defaultDates(),
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Wait for the status check before rendering anything.
  if (statusLoading) return null

  // Setup already done — logged-in users go home, others go to login.
  if (setupStatus && !setupStatus.needsSetup) {
    return <Navigate to={user ? '/' : '/login'} replace />
  }

  function handleChange(patch: Partial<WizardData>) {
    setData(d => ({ ...d, ...patch }))
    setError(null)
  }

  function handleBack() {
    setError(null)
    setStep(s => (s > 1 ? ((s - 1) as Step) : s))
  }

  function handleNext() {
    const err = validateStep(step, data)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep(s => (s < 3 ? ((s + 1) as Step) : s))
  }

  async function handleFinish() {
    const err = validateStep(3, data)
    if (err) {
      setError(err)
      return
    }

    setError(null)
    setLoading(true)

    try {
      // 1. Create account — returns token directly to avoid racing the async
      //    setState inside register() before the next render cycle.
      const token = await register(data.email, data.password, data.displayName)

      // 2. Create team
      const team = await apiFetch<{ id: string }>('/teams', {
        method: 'POST',
        body: JSON.stringify({ name: data.teamName }),
        accessToken: token,
      })

      // 3. Create timeline
      await apiFetch(`/teams/${team.id}/timelines`, {
        method: 'POST',
        body: JSON.stringify({
          name: data.timelineName,
          startDate: data.startDate,
          endDate: data.endDate,
        }),
        accessToken: token,
      })

      // Mark setup as done in the query cache so ProtectedRoute doesn't
      // replay the stale needsSetup:true value after the user logs out.
      queryClient.setQueryData<SetupStatus>(['setup-status'], { needsSetup: false })
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
      <div style={{ position: 'fixed', top: 16, right: 16 }}>
        <DarkModeToggle />
      </div>

      {/* Logo */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          marginBottom: 24,
        }}
      >
        <img src="/logo.svg" alt="draba" style={{ width: 72, height: 72 }} />
        <span
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em',
          }}
        >
          draba
        </span>
      </div>

      <Card style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ padding: '24px 24px 0' }}>
          <StepIndicator current={step} />
        </div>

        {step === 1 && <Step1 data={data} onChange={handleChange} />}
        {step === 2 && <Step2 data={data} onChange={handleChange} />}
        {step === 3 && <Step3 data={data} onChange={handleChange} />}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '0 24px 24px',
          }}
        >
          {error && (
            <p style={{ fontSize: 13, color: 'var(--destructive)', margin: 0 }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1 || loading}
              style={{ flex: 1 }}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button onClick={handleNext} disabled={loading} style={{ flex: 1 }}>
                Next
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Setting up…' : 'Finish'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
