/**
 * /settings/organization — Superadmin: organization name, registration policy,
 * and system-wide defaults (language, timezone, week start).
 */

import { useState, useEffect } from 'react'
import { useAdminSettings, usePatchAdminSettings } from '@/hooks/useSettings'
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

const selectStyle: React.CSSProperties = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: 6,
  color: '#e6edf3',
  padding: '8px 12px',
  fontSize: 13,
  cursor: 'pointer',
}

export default function OrganizationPage() {
  const { data } = useAdminSettings()
  const patch = usePatchAdminSettings()

  const settings = data?.settings ?? {}
  const [orgName, setOrgName] = useState('')
  const [regPolicy, setRegPolicy] = useState('invite_only')
  const [timezone, setTimezone] = useState('UTC')
  const [weekStart, setWeekStart] = useState('monday')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    setOrgName(settings.instance_name || '')
    setRegPolicy(settings.registration_policy || 'invite_only')
    setTimezone(settings.default_timezone || 'UTC')
    setWeekStart(settings.default_week_start || 'monday')
  }, [JSON.stringify(settings)])

  async function handleSave() {
    setFeedback(null)
    try {
      await patch.mutateAsync({
        instance_name: orgName,
        registration_policy: regPolicy,
        default_timezone: timezone,
        default_week_start: weekStart,
      })
      setFeedback({ type: 'success', msg: 'Settings saved.' })
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to save settings. Please try again.' })
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Organization</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        System-wide identity and defaults for this draba installation.
      </p>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Identity
        </h3>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Organization name</Label>
          <Input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="My Company"
            style={{ maxWidth: 320 }}
          />
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
            Shown in the browser tab title and login page.
          </p>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Registration policy</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: 'invite_only', label: 'Invite only' },
              { v: 'open', label: 'Open registration' },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setRegPolicy(v)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, border: '1px solid',
                  borderColor: regPolicy === v ? '#58a6ff' : '#30363d',
                  background: regPolicy === v ? 'rgba(88,166,255,0.1)' : '#161b22',
                  color: regPolicy === v ? '#58a6ff' : '#8b949e',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          System defaults
        </h3>
        <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>
          Applied to new accounts when the user hasn't set their own preference.
        </p>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Default language</Label>
          <select style={{ ...selectStyle, maxWidth: 240, opacity: 0.6, cursor: 'not-allowed' }} disabled>
            <option value="en">English (en)</option>
          </select>
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
            Additional languages coming in a future release.
          </p>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Default timezone</Label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} style={{ ...selectStyle, maxWidth: 280 }}>
            {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
              'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'].map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Default week starts on</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['monday', 'sunday'] as const).map(d => (
              <button
                key={d}
                onClick={() => setWeekStart(d)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 13, border: '1px solid',
                  borderColor: weekStart === d ? '#58a6ff' : '#30363d',
                  background: weekStart === d ? 'rgba(88,166,255,0.1)' : '#161b22',
                  color: weekStart === d ? '#58a6ff' : '#8b949e',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {feedback && (
        <p style={{ fontSize: 13, color: feedback.type === 'success' ? '#3fb950' : '#f85149', marginBottom: 12 }}>
          {feedback.msg}
        </p>
      )}
      <Button onClick={handleSave} disabled={patch.isPending}>
        {patch.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  )
}
