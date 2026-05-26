/**
 * /settings/users — Superadmin: view and search all users; orphaned-user alert.
 */

import { useState } from 'react'
import { useAdminUsers } from '@/hooks/useSettings'
import { Badge } from '@/components/identity/Badge'
import type { Identity } from '@/components/identity/identity-constants'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from 'lucide-react'

export default function AdminUsersPage() {
  const [orphanedOnly, setOrphanedOnly] = useState(false)
  const [search, setSearch] = useState('')
  const { data: allData, error: allError } = useAdminUsers(false)
  const { data: orphanData } = useAdminUsers(true)

  const allUsers = allData?.users ?? []
  const orphanedCount = orphanData?.users?.length ?? 0
  const displayed = (orphanedOnly ? orphanData?.users ?? [] : allUsers)
    .filter(u => {
      if (!search) return true
      const q = search.toLowerCase()
      return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })

  return (
    <div>
      <h2 className="text-[17px] font-semibold text-foreground mb-1">Users</h2>
      <p className="text-sm text-muted-foreground mb-6">
        All accounts in this organization. Use team management to assign or remove memberships.
      </p>

      <div className="bg-card border border-border rounded-[10px] p-6 mb-5">
        {orphanedCount > 0 && !orphanedOnly && (
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 mb-4 bg-warning/10 border border-warning/30 rounded-lg">
            <AlertTriangle size={16} className="text-warning shrink-0" />
            <span className="text-[13px] text-warning">
              {orphanedCount} user{orphanedCount > 1 ? 's' : ''} with no team memberships.
            </span>
            <button
              onClick={() => setOrphanedOnly(true)}
              className="ml-auto text-xs text-warning bg-transparent border-none cursor-pointer underline"
            >
              View
            </button>
          </div>
        )}

        {allError && (
          <div className="px-4 py-3 mb-4 bg-destructive/10 border border-destructive/30 rounded-lg text-[13px] text-destructive">
            Failed to load users. This endpoint requires the Phase 10.1.3 backend — rebuild and redeploy the Docker container.
          </div>
        )}

        <div className="flex gap-2 mb-4 items-center">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="max-w-[300px]"
          />
          <div className="flex gap-1">
            {[
              { label: `All (${allUsers.length})`, v: false },
              { label: `Orphaned (${orphanedCount})`, v: true },
            ].map(({ label, v }) => (
              <button
                key={String(v)}
                onClick={() => setOrphanedOnly(v)}
                className={`px-3 py-1.5 rounded-md text-xs border cursor-pointer ${
                  orphanedOnly === v
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-popover text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['User', 'Email', 'Teams', 'Status'].map(h => (
                  <th key={h} className="text-left text-[11px] text-muted-foreground font-semibold pb-2.5 px-2 tracking-[0.4px]">
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map(u => (
                <tr key={u.id} className="border-t border-card">
                  <td className="py-2.5 px-2 flex items-center gap-2.5">
                    <Badge identity={{ color: u.color ?? '#288C9B', icon: u.icon ?? '__none__' } satisfies Identity} name={u.displayName} size={28} shape="circle" />
                    <span className="text-[13px] text-foreground">{u.displayName}</span>
                    {u.isSuperadmin && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                        superadmin
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-[13px] text-muted-foreground">{u.email}</td>
                  <td className="py-2.5 px-2 text-[13px] text-muted-foreground">{u.teamCount}</td>
                  <td className="py-2.5 px-2">
                    {u.archivedAt ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-destructive/15 text-destructive">
                        Inactive
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-success/15 text-success">
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
