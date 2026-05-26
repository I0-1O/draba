/**
 * /settings/tokens — API token management. Create, list, and revoke tokens.
 * The raw token value is shown exactly once on creation.
 */

import { useState } from 'react'
import { useTokens, useCreateToken, useRevokeToken } from '@/hooks/useSettings'
import { ApiError } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Key, Copy, Check, Trash2 } from 'lucide-react'

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
      <h2 className="text-[17px] font-semibold text-foreground mb-1">API Tokens</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Long-lived tokens for programmatic access. The raw value is shown once — copy it before closing.
      </p>

      {/* One-time secret reveal */}
      {newSecret && (
        <div className="bg-success/10 border border-success/30 rounded-[10px] p-6 mb-5">
          <p className="text-sm text-success font-semibold mb-3">
            Token created — copy it now, it won't be shown again.
          </p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 px-3 py-2 bg-background rounded-md text-xs text-foreground border border-border break-all">
              {newSecret}
            </code>
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5 min-w-[80px]">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 text-muted-foreground"
            onClick={() => setNewSecret(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Token list */}
      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activeTokens.length === 0 ? (
          <div className="text-center py-6">
            <Key size={32} className="text-border mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No API tokens yet.</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Name', 'Scope', 'Last used', 'Created', ''].map(h => (
                  <th key={h} className="text-left text-[11px] text-muted-foreground font-semibold pb-2.5 tracking-[0.4px]">
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTokens.map(tok => (
                <tr key={tok.id} className="border-t border-card">
                  <td className="py-3 text-[13px] text-foreground font-medium">{tok.name}</td>
                  <td className="py-3 px-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {tok.scope}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-[13px] text-muted-foreground">
                    {tok.lastUsedAt ? relativeTime(tok.lastUsedAt) : 'Never'}
                  </td>
                  <td className="py-3 px-2 text-[13px] text-muted-foreground">
                    {relativeTime(tok.createdAt)}
                  </td>
                  <td className="py-3 text-right">
                    {confirmRevoke === tok.id ? (
                      <span className="text-xs flex gap-2 justify-end items-center">
                        <span className="text-destructive">Revoke?</span>
                        <button
                          onClick={() => void handleRevoke(tok.id)}
                          className="text-destructive bg-transparent border-none cursor-pointer text-xs p-0"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmRevoke(null)}
                          className="text-muted-foreground bg-transparent border-none cursor-pointer text-xs p-0"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmRevoke(tok.id)}
                        className="text-muted-foreground bg-transparent border-none cursor-pointer p-1"
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
          className={activeTokens.length > 0 ? 'mt-4' : ''}
          onClick={() => setShowCreate(v => !v)}
        >
          {showCreate ? 'Cancel' : 'New token'}
        </Button>

        {showCreate && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex flex-col gap-1.5 mb-4">
              <Label>Token name</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. CI bot, personal script"
                className="max-w-xs"
              />
            </div>
            <div className="flex flex-col gap-2 mb-4">
              <Label>Scope</Label>
              {SCOPES.map(s => (
                <label key={s.value} className="flex gap-2.5 cursor-pointer items-start">
                  <input
                    type="radio"
                    name="scope"
                    value={s.value}
                    checked={scope === s.value}
                    onChange={() => setScope(s.value)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-[13px] text-foreground font-medium">{s.label}</span>
                    <span className="text-xs text-muted-foreground block">{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {error && <p className="text-[13px] text-destructive mb-3">{error}</p>}
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
