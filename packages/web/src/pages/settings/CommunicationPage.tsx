/**
 * /settings/communication — Superadmin: email / SMTP configuration.
 */

import { useState, useEffect } from 'react'
import { useAdminSMTP, useSaveSMTP, useTestSMTP, useDeleteSMTP } from '@/hooks/useSettings'
import type { components } from '@draba/shared'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff } from 'lucide-react'

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

export default function CommunicationPage() {
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
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Communication</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Configure outbound email for password resets and invitations.
      </p>

      <div style={sectionStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>
          SMTP / Email
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
    </div>
  )
}
