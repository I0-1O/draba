/**
 * /settings/preferences — Regional settings, appearance theme, default team/timeline.
 * Values are stored via the existing GET/PUT /users/me/preferences endpoints.
 * View consumption (Gantt date format, etc.) is deferred to Phase 10.4.
 */

import { useState, useEffect } from 'react'
import { usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences'
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
  maxWidth: 320,
  cursor: 'pointer',
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const DATE_FORMATS = [
  { value: 'MMM D, YYYY', label: 'Jan 5, 2026' },
  { value: 'MM/DD/YYYY', label: '01/05/2026' },
  { value: 'DD/MM/YYYY', label: '05/01/2026' },
  { value: 'YYYY-MM-DD', label: '2026-01-05' },
]

export default function PreferencesPage() {
  const prefMap = usePreferenceMap()
  const upsert = useUpsertPreference()

  const [theme, setTheme] = useState('system')
  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('MMM D, YYYY')
  const [weekStart, setWeekStart] = useState('monday')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    setTheme((prefMap['theme'] as string | undefined) ?? 'system')
    setTimezone((prefMap['timezone'] as string | undefined) ?? 'UTC')
    setDateFormat((prefMap['date_format'] as string | undefined) ?? 'MMM D, YYYY')
    setWeekStart((prefMap['week_start'] as string | undefined) ?? 'monday')
  }, [JSON.stringify(prefMap)])

  function applyTheme(value: string) {
    const html = document.documentElement
    if (value === 'dark') {
      html.classList.add('dark')
    } else if (value === 'light') {
      html.classList.remove('dark')
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }
  }

  function handleThemeChange(value: string) {
    setTheme(value)
    // Apply visually right away so the user sees the change, but only persist on Save.
    applyTheme(value)
  }

  async function handleSave() {
    setFeedback(null)
    try {
      await Promise.all([
        upsert.mutateAsync({ key: 'theme', value: theme }),
        upsert.mutateAsync({ key: 'timezone', value: timezone }),
        upsert.mutateAsync({ key: 'date_format', value: dateFormat }),
        upsert.mutateAsync({ key: 'week_start', value: weekStart }),
      ])
      setFeedback({ type: 'success', msg: 'Preferences saved.' })
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to save preferences. Please try again.' })
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Preferences</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Personal appearance and regional settings.
      </p>

      {/* Appearance */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Appearance
        </h3>
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Theme</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  border: '1px solid',
                  borderColor: theme === t ? '#58a6ff' : '#30363d',
                  background: theme === t ? 'rgba(88,166,255,0.1)' : '#161b22',
                  color: theme === t ? '#58a6ff' : '#8b949e',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>Preview applies immediately; saved when you click Save.</p>
        </div>
      </div>

      {/* Regional */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          Regional
        </h3>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Language</Label>
          <select style={{ ...selectStyle, opacity: 0.6, cursor: 'not-allowed' }} disabled>
            <option value="en">English (en)</option>
          </select>
          <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>
            Additional languages coming in a future release.
          </p>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Timezone</Label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            style={selectStyle}
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Date format</Label>
          <select
            value={dateFormat}
            onChange={e => setDateFormat(e.target.value)}
            style={selectStyle}
          >
            {DATE_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Week starts on</Label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['monday', 'sunday'] as const).map(d => (
              <button
                key={d}
                onClick={() => setWeekStart(d)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  border: '1px solid',
                  borderColor: weekStart === d ? '#58a6ff' : '#30363d',
                  background: weekStart === d ? 'rgba(88,166,255,0.1)' : '#161b22',
                  color: weekStart === d ? '#58a6ff' : '#8b949e',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
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

      <Button onClick={handleSave} disabled={upsert.isPending}>
        {upsert.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  )
}
