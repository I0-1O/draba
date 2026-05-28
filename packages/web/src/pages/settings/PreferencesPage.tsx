/**
 * /settings/preferences — Regional settings, appearance theme, default team/timeline.
 * Values are stored via the existing GET/PUT /users/me/preferences endpoints.
 * Theme changes apply immediately via useDarkMode; the server value syncs on next login.
 */

import { useState, useEffect } from 'react'
import { usePreferenceMap, useUpsertPreference } from '@/hooks/usePreferences'
import { useDarkMode } from '@/hooks/useDarkMode'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

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

const selectCls = 'bg-popover border border-border rounded-md text-foreground px-3 py-2 text-[13px] cursor-pointer max-w-xs'

export default function PreferencesPage() {
  const prefMap = usePreferenceMap()
  const upsert = useUpsertPreference()
  const { theme: currentTheme, applyTheme } = useDarkMode()

  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('MMM D, YYYY')
  const [weekStart, setWeekStart] = useState('monday')
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    setTimezone((prefMap['timezone'] as string | undefined) ?? 'UTC')
    setDateFormat((prefMap['date_format'] as string | undefined) ?? 'MMM D, YYYY')
    setWeekStart((prefMap['week_start'] as string | undefined) ?? 'monday')
    const savedTheme = prefMap['theme'] as string | undefined
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme)
  }, [JSON.stringify(prefMap)]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleThemeChange(t: 'light' | 'dark') {
    setTheme(t)
    applyTheme(t)
  }

  async function handleSave() {
    setFeedback(null)
    try {
      await Promise.all([
        upsert.mutateAsync({ key: 'timezone', value: JSON.stringify(timezone) }),
        upsert.mutateAsync({ key: 'date_format', value: JSON.stringify(dateFormat) }),
        upsert.mutateAsync({ key: 'week_start', value: JSON.stringify(weekStart) }),
        upsert.mutateAsync({ key: 'theme', value: JSON.stringify(theme) }),
      ])
      setFeedback({ type: 'success', msg: 'Preferences saved.' })
      setTimeout(() => setFeedback(null), 2000)
    } catch {
      setFeedback({ type: 'error', msg: 'Failed to save preferences. Please try again.' })
    }
  }

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Preferences</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Personal appearance and regional settings.
      </p>

      {/* Regional */}
      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-4">
          Regional
        </h3>

        {/* Language placeholder — Phase 10.7 */}
        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Language</Label>
          <select disabled className={`${selectCls} opacity-60 cursor-not-allowed`}>
            <option value="en">English (en)</option>
          </select>
          <p className="text-xs text-muted-foreground m-0">
            Additional languages coming in a future release (Phase 10.7).
          </p>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Timezone</Label>
          <select value={timezone} onChange={e => setTimezone(e.target.value)} className={selectCls}>
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Date format</Label>
          <select value={dateFormat} onChange={e => setDateFormat(e.target.value)} className={selectCls}>
            {DATE_FORMATS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Week starts on</Label>
          <div className="flex gap-2">
            {(['monday', 'sunday'] as const).map(d => (
              <button
                key={d}
                onClick={() => setWeekStart(d)}
                className={`px-4 py-1.5 rounded-md text-[13px] border cursor-pointer capitalize ${
                  weekStart === d
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-popover text-muted-foreground'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-4">
          Appearance
        </h3>
        <div className="flex flex-col gap-1.5 mb-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map(t => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`px-4 py-1.5 rounded-md text-[13px] border cursor-pointer capitalize ${
                  theme === t
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-popover text-muted-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground m-0">
            Applies immediately. Persisted server-side so it syncs across devices.
          </p>
        </div>
      </div>

      {feedback && (
        <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
          {feedback.msg}
        </p>
      )}

      <Button onClick={handleSave} disabled={upsert.isPending}>
        {upsert.isPending ? 'Saving…' : 'Save preferences'}
      </Button>
    </div>
  )
}
