/**
 * Filter management panel. Listed user's own filters and team-promoted filters,
 * with edit, delete, and promote/demote actions. Opens in the RightSidebar.
 */

import { useState } from 'react'
import type { components } from '@draba/shared'
import { useSavedFilters, useUpdateSavedFilter, useDeleteSavedFilter } from '@/hooks/useSavedFilters'
import { useAuth } from '@/contexts/AuthContext'
import { Pencil, Trash2, Users, User } from 'lucide-react'

type SavedFilter = components['schemas']['SavedFilter']

// ── Styles ────────────────────────────────────────────────────────────────────

const BTN_SM: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '3px 8px',
  border: '1px solid var(--border)',
  borderRadius: 5,
  fontSize: 11,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  background: 'transparent',
  color: 'var(--foreground)',
  transition: 'all 0.1s',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string
  isAdmin: boolean
  onEdit: (filter: SavedFilter) => void
  onClose: () => void
}

// ── Sub-component: filter row ─────────────────────────────────────────────────

interface FilterRowProps {
  filter: SavedFilter
  isAdmin: boolean
  currentUserId: string
  onEdit: () => void
  onDelete: () => void
  onPromote: () => void
  onDemote: () => void
}

function FilterRow({ filter, isAdmin, currentUserId, onEdit, onDelete, onPromote, onDemote }: FilterRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isOwner = filter.userId === currentUserId

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Team badge */}
        {filter.isTeamFilter && (
          <span style={{
            flexShrink: 0,
            marginTop: 2,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(40,140,155,.1)',
            border: '1px solid rgba(40,140,155,.25)',
            borderRadius: 99,
            padding: '1px 5px',
          }}>
            <Users size={8} strokeWidth={2} />
            Team
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filter.name}
          </div>
          {!isOwner && (
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
              <User size={10} strokeWidth={1.8} /> Team filter
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!confirmDelete ? (
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          {(isOwner || isAdmin) && (
            <button type="button" onClick={onEdit} style={BTN_SM}>
              <Pencil size={10} strokeWidth={2} /> Edit
            </button>
          )}
          {/* Promote/demote — admin only */}
          {isAdmin && !filter.isTeamFilter && (
            <button type="button" onClick={onPromote} style={{ ...BTN_SM, color: 'var(--primary)', borderColor: 'rgba(40,140,155,.3)' }}>
              <Users size={10} strokeWidth={2} /> Promote to team
            </button>
          )}
          {isAdmin && filter.isTeamFilter && (
            <button type="button" onClick={onDemote} style={BTN_SM}>
              <User size={10} strokeWidth={2} /> Make personal
            </button>
          )}
          {/* Delete: owner always; admin can delete team filters */}
          {(isOwner || (isAdmin && filter.isTeamFilter)) && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              style={{ ...BTN_SM, color: 'var(--destructive)', borderColor: 'var(--destructive)' }}>
              <Trash2 size={10} strokeWidth={2} /> Delete
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flex: 1 }}>Delete "{filter.name}"?</span>
          <button type="button" onClick={() => setConfirmDelete(false)} style={BTN_SM}>Cancel</button>
          <button type="button" onClick={onDelete}
            style={{ ...BTN_SM, background: 'var(--destructive)', color: 'white', borderColor: 'var(--destructive)' }}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FilterManagePanel({ teamId, isAdmin, onEdit }: Props) {
  const { user } = useAuth()
  const currentUserId = (user as { id?: string } | null)?.id ?? ''

  const { data: filters = [] } = useSavedFilters(teamId)
  const updateFilter = useUpdateSavedFilter(teamId)
  const deleteFilter = useDeleteSavedFilter(teamId)

  const myFilters = filters.filter(f => f.userId === currentUserId && !f.isTeamFilter)
  const teamFilters = filters.filter(f => f.isTeamFilter)

  function promote(filter: SavedFilter) {
    updateFilter.mutate({ id: filter.id, isTeamFilter: true })
  }

  function demote(filter: SavedFilter) {
    updateFilter.mutate({ id: filter.id, isTeamFilter: false })
  }

  function remove(filter: SavedFilter) {
    deleteFilter.mutate(filter.id)
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)',
        padding: '12px 0 4px',
      }}>
        {label}
      </div>
    )
  }

  const noFilters = myFilters.length === 0 && teamFilters.length === 0

  return (
    <div style={{ padding: '0 16px', overflowY: 'auto', height: '100%' }}>
      {noFilters && (
        <p style={{ color: 'var(--muted-foreground)', fontSize: 13, marginTop: 16 }}>
          No saved filters yet. Use "Add filter" to create one.
        </p>
      )}

      {teamFilters.length > 0 && (
        <>
          <SectionHeader label="Team filters" />
          {teamFilters.map(f => (
            <FilterRow
              key={f.id}
              filter={f}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onEdit={() => onEdit(f)}
              onDelete={() => remove(f)}
              onPromote={() => promote(f)}
              onDemote={() => demote(f)}
            />
          ))}
        </>
      )}

      {myFilters.length > 0 && (
        <>
          <SectionHeader label="My filters" />
          {myFilters.map(f => (
            <FilterRow
              key={f.id}
              filter={f}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              onEdit={() => onEdit(f)}
              onDelete={() => remove(f)}
              onPromote={() => promote(f)}
              onDemote={() => demote(f)}
            />
          ))}
        </>
      )}
    </div>
  )
}
