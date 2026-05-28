/**
 * /settings/organization — Superadmin: organization name, registration policy,
 * and system-wide defaults (language placeholder, timezone, week start).
 * Language support is deferred to Phase 10.7 — Localization & Language Support.
 */

import { useState, useEffect } from 'react'
import { useAdminSettings, usePatchAdminSettings } from '@/hooks/useSettings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export default function OrganizationPage() {
  const { data } = useAdminSettings()
  const patch = usePatchAdminSettings()

  const settings = data?.settings ?? {}
  const [orgName, setOrgName] = useState('')
  const [accentColor, setAccentColor] = useState('')
  const [regPolicy, setRegPolicy] = useState('invite_only')
  const [timezone, setTimezone] = useState('UTC')
  const [weekStart, setWeekStart] = useState('monday')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    setOrgName(settings.instance_name || '')
    setAccentColor(settings.accent_color || '')
    setRegPolicy(settings.registration_policy || 'invite_only')
    setTimezone(settings.default_timezone || 'UTC')
    setWeekStart(settings.default_week_start || 'monday')
  }, [JSON.stringify(settings)])

  async function handleSave() {
    setFeedback(null)
    try {
      await patch.mutateAsync({
        instance_name: orgName,
        accent_color: accentColor,
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
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Organization</h2>
      <p className="text-sm text-muted-foreground mb-6">
        System-wide identity and defaults for this draba installation.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-4">
          Identity
        </h3>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Organization name</Label>
          <Input
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            placeholder="My Company"
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground m-0">
            Shown in the browser tab title and login page.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Accent color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor || '#288C9B'}
              onChange={e => setAccentColor(e.target.value)}
              className="h-9 w-14 rounded border border-border cursor-pointer bg-transparent"
            />
            <Input
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              placeholder="#288C9B"
              className="max-w-[140px] font-mono text-[13px]"
            />
            {accentColor && (
              <button
                type="button"
                onClick={() => setAccentColor('')}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground m-0">
            Overrides the primary color globally. Leave blank to use the default teal.
          </p>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Registration policy</Label>
          <div className="flex gap-2">
            {[
              { v: 'invite_only', label: 'Invite only' },
              { v: 'open', label: 'Open registration' },
            ].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setRegPolicy(v)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] border cursor-pointer ${
                  regPolicy === v
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-popover text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-2">
          System defaults
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Applied to new accounts when the user hasn't set their own preference.
        </p>

        {/* Language placeholder — Phase 10.7 */}
        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Default language</Label>
          <select
            disabled
            className="bg-popover border border-border rounded-md text-foreground px-3 py-2 text-[13px] max-w-[240px] opacity-60 cursor-not-allowed"
          >
            <option value="en">English (en)</option>
          </select>
          <p className="text-xs text-muted-foreground m-0">
            Additional languages coming in a future release (Phase 10.7).
          </p>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Default timezone</Label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="bg-popover border border-border rounded-md text-foreground px-3 py-2 text-[13px] cursor-pointer max-w-[280px]"
          >
            {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
              'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'].map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Default week starts on</Label>
          <div className="flex gap-2">
            {(['monday', 'sunday'] as const).map(d => (
              <button
                key={d}
                onClick={() => setWeekStart(d)}
                className={`px-3.5 py-1.5 rounded-md text-[13px] border cursor-pointer capitalize ${
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

      {feedback && (
        <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
          {feedback.msg}
        </p>
      )}
      <Button onClick={handleSave} disabled={patch.isPending}>
        {patch.isPending ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  )
}
