/**
 * Filter builder UI. Renders a name input, AND/OR toggle, condition rows,
 * and Save/Delete/Cancel footer. Used in the RightSidebar.
 *
 * When `filter` is defined, the component is in edit mode; otherwise new.
 */

import { useState, useMemo } from 'react'
import type { components } from '@draba/shared'
import type { FilterCondition, FilterDefinition } from '@/lib/filterTypes'
import { useTeamMembers, useTeamTimelines } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import { useTags } from '@/hooks/useTags'
import {
  useCreateSavedFilter,
  useUpdateSavedFilter,
  useDeleteSavedFilter,
} from '@/hooks/useSavedFilters'
import FilterConditionRow from './FilterConditionRow'
import { Plus } from 'lucide-react'

type SavedFilter = components['schemas']['SavedFilter']

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBlankCondition(): FilterCondition {
  return { field: 'title', op: 'contains', value: '' }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 14px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  transition: 'all 0.1s',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string
  timelineId: string
  /** When provided, the editor is in "edit" mode for this filter. */
  filter?: SavedFilter
  onSave: (filter: SavedFilter) => void
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterEditor({ teamId, timelineId, filter, onSave, onClose }: Props) {
  const isEdit = Boolean(filter)

  const [name, setName] = useState(filter?.name ?? '')
  const [logic, setLogic] = useState<'and' | 'or'>(() => {
    if (!filter) return 'and'
    try {
      const def = JSON.parse(filter.definition) as FilterDefinition
      return def.logic ?? 'and'
    } catch { return 'and' }
  })
  const [conditions, setConditions] = useState<FilterCondition[]>(() => {
    if (!filter) return [makeBlankCondition()]
    try {
      const def = JSON.parse(filter.definition) as FilterDefinition
      return def.conditions?.length ? def.conditions : [makeBlankCondition()]
    } catch { return [makeBlankCondition()] }
  })
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Data for value inputs
  const { data: members = [] } = useTeamMembers(teamId)
  const { data: tags = [] } = useTags(teamId)
  const { data: timelines = [] } = useTeamTimelines(teamId)

  // Collect statuses from all team timelines (deduped by name)
  const firstTimelineId = timelines[0]?.id ?? timelineId
  const { data: firstStatuses = [] } = useTimelineStatuses(teamId, firstTimelineId)
  const statusOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { value: string; label: string }[] = []
    firstStatuses.forEach(s => {
      const key = s.name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        opts.push({ value: s.name, label: s.name })
      }
    })
    return opts
  }, [firstStatuses])

  const createFilter = useCreateSavedFilter(teamId)
  const updateFilter = useUpdateSavedFilter(teamId)
  const deleteFilter = useDeleteSavedFilter(teamId)

  function updateCondition(index: number, next: FilterCondition) {
    setConditions(prev => prev.map((c, i) => i === index ? next : c))
  }

  function removeCondition(index: number) {
    setConditions(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length ? next : [makeBlankCondition()]
    })
  }

  function addCondition() {
    setConditions(prev => [...prev, makeBlankCondition()])
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null)

    const def: FilterDefinition = { logic, conditions }
    const definition = JSON.stringify(def)

    try {
      if (isEdit && filter) {
        const updated = await updateFilter.mutateAsync({ id: filter.id, name: name.trim(), definition })
        onSave(updated)
      } else {
        const created = await createFilter.mutateAsync({ name: name.trim(), definition })
        onSave(created)
      }
    } catch {
      setError('Failed to save filter. Please try again.')
    }
  }

  async function handleDelete() {
    if (!filter) return
    try {
      await deleteFilter.mutateAsync(filter.id)
      onClose()
    } catch {
      setError('Failed to delete filter.')
    }
  }

  const isSaving = createFilter.isPending || updateFilter.isPending
  const isDeleting = deleteFilter.isPending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Name */}
      <div style={{ padding: '16px 16px 0' }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 5 }}>
          Filter name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. My open tasks"
          autoFocus
          style={{
            width: '100%',
            padding: '7px 10px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* AND / OR toggle */}
      <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Match</span>
        {(['and', 'or'] as const).map(l => (
          <button
            key={l}
            type="button"
            onClick={() => setLogic(l)}
            style={{
              ...BTN,
              padding: '4px 10px',
              background: logic === l ? 'var(--primary)' : 'var(--card)',
              color: logic === l ? 'white' : 'var(--foreground)',
              borderColor: logic === l ? 'var(--primary)' : 'var(--border)',
            }}
          >
            {l === 'and' ? 'all' : 'any'}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>conditions</span>
      </div>

      {/* Conditions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {conditions.map((c, i) => (
          <FilterConditionRow
            key={i}
            condition={c}
            statusOptions={statusOptions}
            tags={tags}
            members={members}
            onChange={next => updateCondition(i, next)}
            onRemove={() => removeCondition(i)}
          />
        ))}

        <button
          type="button"
          onClick={addCondition}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 0',
            border: 'none',
            background: 'transparent',
            color: 'var(--primary)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Plus size={13} strokeWidth={2} />
          Add condition
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '0 16px 8px', fontSize: 12, color: 'var(--destructive)' }}>{error}</div>
      )}

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        {isEdit && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{ ...BTN, color: 'var(--destructive)', borderColor: 'var(--destructive)', background: 'transparent', marginRight: 'auto' }}
          >
            Delete
          </button>
        )}
        {confirmDelete && (
          <>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginRight: 'auto' }}>Delete this filter?</span>
            <button type="button" onClick={() => setConfirmDelete(false)} style={{ ...BTN, background: 'var(--card)', color: 'var(--foreground)' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              style={{ ...BTN, background: 'var(--destructive)', color: 'white', border: 'none' }}
            >
              {isDeleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </>
        )}
        {!confirmDelete && (
          <>
            <button type="button" onClick={onClose} style={{ ...BTN, background: 'var(--card)', color: 'var(--foreground)', marginLeft: isEdit ? 0 : 'auto' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{ ...BTN, background: 'var(--primary)', color: 'white', border: 'none' }}
            >
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Save filter'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
