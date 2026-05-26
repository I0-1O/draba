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
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Communication</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Configure outbound email for password resets and invitations.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-[0.5px] mb-4">
          SMTP / Email
        </h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label>SMTP host</Label>
            <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Port</Label>
            <Input value={port} onChange={e => setPort(e.target.value)} placeholder="587" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Username</Label>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@smtp.example.com" className="max-w-[360px]" />
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Password</Label>
          <div className="relative max-w-[360px]">
            <Input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-muted-foreground cursor-pointer"
            >
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1.5">
            <Label>From name</Label>
            <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="draba" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>From email</Label>
            <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <Label>Encryption</Label>
          <select
            value={encryption}
            onChange={e => setEncryption(e.target.value as 'none' | 'tls' | 'starttls')}
            className="bg-popover border border-border rounded-md text-foreground px-3 py-2 text-[13px] cursor-pointer max-w-[200px]"
          >
            <option value="none">None</option>
            <option value="tls">TLS</option>
            <option value="starttls">STARTTLS</option>
          </select>
        </div>

        {feedback && (
          <p className={`text-[13px] mb-3 ${feedback.type === 'success' ? 'text-success' : 'text-destructive'}`}>
            {feedback.msg}
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={saveSMTP.isPending || !host}>
            {saveSMTP.isPending ? 'Saving…' : 'Save SMTP settings'}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testSMTP.isPending || !host}>
            {testState === 'sending' ? 'Sending…' : testState === 'sent' ? 'Sent!' : 'Send test email'}
          </Button>
          {data?.smtp && (
            <Button variant="ghost" className="text-destructive" onClick={handleDelete}>
              Clear config
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          When SMTP is not configured, password resets and email invitations are unavailable.
        </p>
      </div>
    </div>
  )
}
