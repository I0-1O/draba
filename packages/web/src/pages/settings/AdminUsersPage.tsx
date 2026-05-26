/**
 * /settings/users — Superadmin: view and search all users; orphaned-user alert.
 */

import { useState } from 'react'
import { useAdminUsers } from '@/hooks/useSettings'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from 'lucide-react'

const sectionStyle: React.CSSProperties = {
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: 10,
  padding: '24px',
  marginBottom: 20,
}

export default function AdminUsersPage() {
  const [orphanedOnly, setOrphanedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const { data: allData, error: allError } = useAdminUsers(false)
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
    <div>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>Users</h2>
      <p style={{ fontSize: 13, color: '#8b949e', marginBottom: 24 }}>
        All accounts in this organization. Use team management to assign or remove memberships.
      </p>

      <div style={sectionStyle}>
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

        {allError && (
        <div style={{
          padding: '12px 16px', marginBottom: 16,
          background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)',
          borderRadius: 8, fontSize: 13, color: '#f85149',
        }}>
          Failed to load users. This endpoint requires the Phase 10.1.3 backend — rebuild and redeploy the Docker container.
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
    </div>
  )
}
