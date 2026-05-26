/**
 * /settings/tokens — API token management. Create, list, and revoke tokens.
 * The raw token value is shown exactly once on creation.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { createAuthFetch, ApiError } from '@/lib/api'
import type { components } from '@draba/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Key, Copy, Check, Trash2 } from 'lucide-react'

type APIToken = components['schemas']['APIToken']

const sectionStyle: React.CSSProperties = {
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 20,
}

function useTokens() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: ['tokens'],
    queryFn: () => authFetch<APIToken[]>('/tokens'),
  })
}

function useCreateToken() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; scope: string }) =>
      authFetch<{ token: APIToken; rawValue: string }>('/tokens', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  })
}

function useRevokeToken() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  })
}

const SCOPES: { value: string; label: string; desc: string }[] = [
  { value: 'read', label: 'Read-only', desc: 'Can read data but not create or modify.' },
  { value: 'add', label: 'Add', desc: 'Can create new activities and timelines.' },
  { value: 'edit_own', label: 'Edit own', desc: 'Can edit activities created by this user.' },
  { value: 'edit_all', label: 'Edit all', desc: 'Full read-write access.' },
]

function relativeTime(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''} ago`
}

export default function TokensPage() {
  const { data: tokens = [], isLoading } = useTokens()
  const createToken = useCreateToken()
  const revokeToken = useRevokeToken()

  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [scope, setScope] = useState('read')
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  const activeTokens = tokens.filter(t => !t.revokedAt)

  async function handleCreate() {
    setError(null)
    try {
      const result = await createToken.mutateAsync({ name: name.trim(), scope })
      setNewSecret(result.rawValue)
      setName('')
      setScope('read')
      setShowCreate(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create token.')
    }
  }

  async function handleCopy() {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke(id: string) {
    await revokeToken.mutateAsync(id)
    setConfirmRevoke(null)
  }

  return (
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>API Tokens</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        Long-lived tokens for programmatic access. The raw value is shown once — copy it before closing.
      </p>

      {/* One-time secret reveal */}
      {newSecret && (
        <div style={{ ...sectionStyle, borderColor: '#238636', background: 'rgba(35,134,54,0.1)', marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: '#3fb950', marginBottom: 12, fontWeight: 600 }}>
            Token created — copy it now, it won't be shown again.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '8px 12px', background: '#0d1117',
              borderRadius: 6, fontSize: 12, color: '#e6edf3',
              border: '1px solid #30363d', wordBreak: 'break-all',
            }}>
              {newSecret}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy} style={{ gap: 6, minWidth: 80 }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            style={{ marginTop: 12, color: '#8b949e' }}
            onClick={() => setNewSecret(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Token list */}
      <div style={sectionStyle}>
        {isLoading ? (
          <p style={{ fontSize: 13, color: '#8b949e' }}>Loading…</p>
        ) : activeTokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Key size={32} style={{ color: '#30363d', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: '#8b949e' }}>No API tokens yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Scope', 'Last used', 'Created', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, color: '#8b949e', fontWeight: 600, padding: '0 0 10px', letterSpacing: '0.4px' }}>
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTokens.map(tok => (
                <tr key={tok.id} style={{ borderTop: '1px solid #21262d' }}>
                  <td style={{ padding: '12px 0', fontSize: 13, color: '#e6edf3', fontWeight: 500 }}>{tok.name}</td>
                  <td style={{ padding: '12px 8px', fontSize: 12 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: '#30363d', color: '#8b949e',
                    }}>
                      {tok.scope}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: 13, color: '#8b949e' }}>
                    {tok.lastUsedAt ? relativeTime(tok.lastUsedAt) : 'Never'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: 13, color: '#8b949e' }}>
                    {relativeTime(tok.createdAt)}
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'right' }}>
                    {confirmRevoke === tok.id ? (
                      <span style={{ fontSize: 12, display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <span style={{ color: '#f85149' }}>Revoke?</span>
                        <button
                          onClick={() => void handleRevoke(tok.id)}
                          style={{ color: '#f85149', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRevoke(null)}
                          style={{ color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(tok.id)}
                        style={{ color: '#8b949e', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                        title="Revoke"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Button
          size="sm"
          variant="outline"
          style={{ marginTop: activeTokens.length > 0 ? 16 : 0 }}
          onClick={() => setShowCreate(v => !v)}
        >
          {showCreate ? 'Cancel' : 'New token'}
        </Button>

        {showCreate && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #30363d' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Label style={{ color: '#e6edf3' }}>Token name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CI bot, personal script"
                style={{ maxWidth: 320 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              <Label style={{ color: '#e6edf3' }}>Scope</Label>
              {SCOPES.map(s => (
                <label key={s.value} style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="radio"
                    name="scope"
                    value={s.value}
                    checked={scope === s.value}
                    onChange={() => setScope(s.value)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ fontSize: 13, color: '#e6edf3', fontWeight: 500 }}>{s.label}</span>
                    <span style={{ fontSize: 12, color: '#8b949e', display: 'block' }}>{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {error && <p style={{ fontSize: 13, color: '#f85149', marginBottom: 12 }}>{error}</p>}
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || createToken.isPending}
            >
              {createToken.isPending ? 'Creating…' : 'Create token'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
