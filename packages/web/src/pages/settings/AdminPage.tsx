/**
 * /settings/admin — Superadmin-only: SMTP, instance settings, user management.
 */

import { useState, useEffect } from 'react'
import {
  useAdminSMTP,
  useSaveSMTP,
  useTestSMTP,
  useDeleteSMTP,
  useAdminSettings,
  usePatchAdminSettings,
  useAdminUsers,
} from '@/hooks/useSettings'
import type { components } from '@draba/shared'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'

type SMTPConfig = components['schemas']['SMTPConfig']

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

// ── SMTP section ──────────────────────────────────────────────────────────────

function SMTPSection() {
  const { data } = useAdminSMTP()
  const saveSMTP = useSaveSMTP()
  const testSMTP = useTestSMTP()
  const deleteSMTP = useDeleteSMTP()

  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromName, setFromName] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [encryption, setEncryption] = useState<'none' | 'tls' | 'starttls'>('starttls')
  const [showPw, setShowPw] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  useEffect(() => {
    const cfg = data?.smtp
    if (cfg) {
      setHost(cfg.host ?? '')
      setPort(String(cfg.port ?? 587))
      setUsername(cfg.username ?? '')
      setFromName(cfg.fromName ?? '')
      setFromEmail(cfg.fromEmail ?? '')
      setEncryption((cfg.encryption as 'none' | 'tls' | 'starttls') ?? 'starttls')
    }
  }, [data])

  function buildConfig(): SMTPConfig {
    return { host, port: parseInt(port, 10), username, password, fromName, fromEmail, encryption }
  }

  async function handleSave() {
    setFeedback(null)
    try {
      await saveSMTP.mutateAsync(buildConfig())
      setFeedback({ type: 'success', msg: 'SMTP settings saved and validated.' })
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to save SMTP settings.'
      setFeedback({ type: 'error', msg })
    }
  }

  async function handleTest() {
    setTestState('sending')
    try {
      const res = await testSMTP.mutateAsync(buildConfig())
      setTestState('sent')
      setFeedback({ type: 'success', msg: `Test email sent to ${res.to}` })
    } catch (err) {
      setTestState('failed')
      const msg = err instanceof ApiError ? err.message : 'SMTP test failed.'
      setFeedback({ type: 'error', msg })
    }
    setTimeout(() => setTestState('idle'), 3000)
  }

  async function handleDelete() {
    await deleteSMTP.mutateAsync()
    setHost(''); setPort('587'); setUsername(''); setPassword('')
    setFromName(''); setFromEmail(''); setEncryption('starttls')
    setFeedback({ type: 'success', msg: 'SMTP configuration cleared.' })
  }

  return (
    <div style={sectionStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        Email / SMTP
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>SMTP host</Label>
          <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
        </div>
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>Port</Label>
          <Input value={port} onChange={e => setPort(e.target.value)} placeholder="587" />
        </div>
      </div>

      <div style={fieldStyle}>
        <Label style={{ color: '#e6edf3' }}>Username</Label>
        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@smtp.example.com" style={{ maxWidth: 360 }} />
      </div>

      <div style={fieldStyle}>
        <Label style={{ color: '#e6edf3' }}>Password</Label>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button
            onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' }}
          >
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>From name</Label>
          <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="draba" />
        </div>
        <div style={fieldStyle}>
          <Label style={{ color: '#e6edf3' }}>From email</Label>
          <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
        </div>
      </div>

      <div style={fieldStyle}>
        <Label style={{ color: '#e6edf3' }}>Encryption</Label>
        <select
          value={encryption}
          onChange={e => setEncryption(e.target.value as 'none' | 'tls' | 'starttls')}
          style={{ ...selectStyle, maxWidth: 200 }}
        >
          <option value="none">None</option>
          <option value="tls">TLS</option>
          <option value="starttls">STARTTLS</option>
        </select>
      </div>

      {feedback && (
        <p style={{ fontSize: 13, color: feedback.type === 'success' ? '#3fb950' : '#f85149', marginBottom: 12 }}>
          {feedback.msg}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={handleSave} disabled={saveSMTP.isPending || !host}>
          {saveSMTP.isPending ? 'Saving…' : 'Save SMTP settings'}
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={testSMTP.isPending || !host}>
          {testState === 'sending' ? 'Sending…' : testState === 'sent' ? 'Sent!' : 'Send test email'}
        </Button>
        {data?.smtp && (
          <Button variant="ghost" style={{ color: '#f85149' }} onClick={handleDelete}>
            Clear config
          </Button>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#8b949e', marginTop: 12 }}>
        When SMTP is not configured, password resets and email invitations are unavailable.
      </p>
    </div>
  )
}

// ── Instance defaults section ─────────────────────────────────────────────────

function InstanceSection() {
  const { data } = useAdminSettings()
  const patch = usePatchAdminSettings()

  const settings = data?.settings ?? {}
  const [regPolicy, setRegPolicy] = useState('invite_only')
  const [timezone, setTimezone] = useState('UTC')
  const [dateFormat, setDateFormat] = useState('MMM D, YYYY')
  const [weekStart, setWeekStart] = useState('monday')
  const [instanceName, setInstanceName] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    setRegPolicy(settings.registration_policy || 'invite_only')
    setTimezone(settings.default_timezone || 'UTC')
    setDateFormat(settings.default_date_format || 'MMM D, YYYY')
    setWeekStart(settings.default_week_start || 'monday')
    setInstanceName(settings.instance_name || '')
  }, [JSON.stringify(settings)])

  async function handleSave() {
    setFeedback(null)
    await patch.mutateAsync({
      registration_policy: regPolicy,
      default_timezone: timezone,
      default_date_format: dateFormat,
      default_week_start: weekStart,
      instance_name: instanceName,
    })
    setFeedback('Settings saved.')
    setTimeout(() => setFeedback(null), 2000)
  }

  return (
    <div style={sectionStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        Instance defaults
      </h3>

      <div style={fieldStyle}>
        <Label style={{ color: '#e6edf3' }}>Instance name</Label>
        <Input
          value={instanceName}
          onChange={e => setInstanceName(e.target.value)}
          placeholder="draba"
          style={{ maxWidth: 320 }}
        />
        <p style={{ fontSize: 12, color: '#8b949e', margin: 0 }}>Shown in the browser tab title and login page.</p>
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

      {feedback && <p style={{ fontSize: 13, color: '#3fb950', marginBottom: 12 }}>{feedback}</p>}
      <Button onClick={handleSave} disabled={patch.isPending}>
        {patch.isPending ? 'Saving…' : 'Save defaults'}
      </Button>
    </div>
  )
}

// ── Users section ─────────────────────────────────────────────────────────────

function UsersSection() {
  const [orphanedOnly, setOrphanedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const { data: allData } = useAdminUsers(false)
  const { data: orphanData } = useAdminUsers(true)

  const allUsers = allData?.users ?? []
  const orphanedCount = orphanData?.users.length ?? 0
  const displayed = (orphanedOnly ? orphanData?.users ?? [] : allUsers)
    .filter(u => {
      if (!search) return true
      const q = search.toLowerCase()
      return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })

  return (
    <div style={sectionStyle}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
        Users
      </h3>

      {orphanedCount > 0 && !orphanedOnly && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', marginBottom: 16,
          background: 'rgba(210,153,34,0.1)', border: '1px solid rgba(210,153,34,0.3)',
          borderRadius: 8,
        }}>
          <AlertTriangle size={16} style={{ color: '#d2993a', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#d2993a' }}>
            {orphanedCount} user{orphanedCount > 1 ? 's' : ''} with no team memberships.
          </span>
          <button
            onClick={() => setOrphanedOnly(true)}
            style={{ marginLeft: 'auto', fontSize: 12, color: '#d2993a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            View
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ maxWidth: 300 }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: `All (${allUsers.length})`, v: false },
            { label: `Orphaned (${orphanedCount})`, v: true },
          ].map(({ label, v }) => (
            <button
              key={String(v)}
              onClick={() => setOrphanedOnly(v)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, border: '1px solid',
                borderColor: orphanedOnly === v ? '#58a6ff' : '#30363d',
                background: orphanedOnly === v ? 'rgba(88,166,255,0.1)' : '#161b22',
                color: orphanedOnly === v ? '#58a6ff' : '#8b949e',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {displayed.length === 0 ? (
        <p style={{ fontSize: 13, color: '#8b949e' }}>No users found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['User', 'Email', 'Teams', 'Status'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#8b949e', fontWeight: 600, padding: '0 8px 10px', letterSpacing: '0.4px' }}>
                  {h.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayed.map(u => (
              <tr key={u.id} style={{ borderTop: '1px solid #21262d' }}>
                <td style={{ padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Badge identity={{ color: u.color ?? '#288C9B', icon: u.icon ?? '__none__' } satisfies Identity} name={u.displayName} size={28} shape="circle" />
                  <span style={{ fontSize: 13, color: '#e6edf3' }}>{u.displayName}</span>
                  {u.isSuperadmin && (
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(88,166,255,0.15)', color: '#58a6ff' }}>
                      superadmin
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#8b949e' }}>{u.email}</td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#8b949e' }}>{u.teamCount}</td>
                <td style={{ padding: '10px 8px' }}>
                  {u.archivedAt ? (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(248,81,73,0.15)', color: '#f85149' }}>
                      Inactive
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'rgba(63,185,80,0.15)', color: '#3fb950' }}>
                      Active
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Administration</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Superadmin controls for SMTP, registration policy, and user management.
      </p>
      <SMTPSection />
      <InstanceSection />
      <UsersSection />
    </div>
  )
}
