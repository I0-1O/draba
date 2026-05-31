/**
 * A single condition row in the filter builder. Renders three contextual
 * controls: field selector → operator selector → value input. A remove
 * button (×) sits on the right.
 */

import { useState } from 'react'
import type { components } from '@draba/shared'
import type { FilterCondition, SetOp, StringOp, NumberOp, DateOp } from '@/lib/filterTypes'
import { X } from 'lucide-react'

type Tag = components['schemas']['Tag']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

// ── Field metadata ────────────────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: 'status',    label: 'Status' },
  { value: 'tag',       label: 'Tag' },
  { value: 'assignee',  label: 'Assignee' },
  { value: 'title',     label: 'Title' },
  { value: 'progress',  label: 'Progress' },
  { value: 'hasParent', label: 'Has parent' },
  { value: 'startDate', label: 'Start date' },
  { value: 'endDate',   label: 'End date' },
] as const

type FieldValue = typeof FIELD_OPTIONS[number]['value']

// Operators per field category
const SET_OPS: { value: SetOp; label: string }[] = [
  { value: 'in',           label: 'is any of' },
  { value: 'not_in',       label: 'is none of' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]
const STRING_OPS: { value: StringOp; label: string }[] = [
  { value: 'contains',     label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'equals',       label: 'is exactly' },
  { value: 'not_equals',   label: 'is not' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]
const NUMBER_OPS: { value: NumberOp; label: string }[] = [
  { value: 'equals',       label: '=' },
  { value: 'not_equals',   label: '≠' },
  { value: 'gte',          label: '≥' },
  { value: 'lte',          label: '≤' },
  { value: 'gt',           label: '>' },
  { value: 'lt',           label: '<' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]
const DATE_OPS: { value: DateOp; label: string }[] = [
  { value: 'before',       label: 'before' },
  { value: 'after',        label: 'after' },
  { value: 'between',      label: 'between' },
  { value: 'is_empty',     label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the default operator for a given field. */
function defaultOp(field: FieldValue): string {
  switch (field) {
    case 'status':    return 'in'
    case 'tag':       return 'in'
    case 'assignee':  return 'in'
    case 'title':     return 'contains'
    case 'progress':  return 'gte'
    case 'hasParent': return 'is_true'
    case 'startDate': return 'before'
    case 'endDate':   return 'before'
  }
}

/** Build a fresh FilterCondition for the given field. */
function buildCondition(field: FieldValue, op?: string): FilterCondition {
  const operator = op ?? defaultOp(field)
  switch (field) {
    case 'status':   return { field: 'status',   op: (operator as SetOp),    value: [] }
    case 'tag':      return { field: 'tag',       op: (operator as SetOp),    value: [] }
    case 'assignee': return { field: 'assignee',  op: (operator as SetOp),    value: [] }
    case 'title':    return { field: 'title',     op: (operator as StringOp), value: '' }
    case 'progress': return { field: 'progress',  op: (operator as NumberOp), value: 0 }
    case 'hasParent':return { field: 'hasParent', op: 'is_true' }
    case 'startDate':return { field: 'startDate', op: (operator as DateOp),   value: '' }
    case 'endDate':  return { field: 'endDate',   op: (operator as DateOp),   value: '' }
  }
}

/** Operators that don't need a value input. */
const NO_VALUE_OPS = new Set(['is_empty', 'is_not_empty', 'is_true', 'is_false'])

// ── Sub-components ────────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  padding: '4px 6px',
  border: '1px solid var(--border)',
  borderRadius: 5,
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
}

interface MultiSelectProps {
  options: { value: string; label: string; color?: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

function MultiSelect({ options, selected, onChange, placeholder = 'Select…' }: MultiSelectProps) {
  const [open, setOpen] = useState(false)

  function toggle(val: string) {
    onChange(
      selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val],
    )
  }

  return (
    <div style={{ position: 'relative', minWidth: 120 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...SELECT_STYLE, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 180 }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? (options.find(o => o.value === selected[0])?.label ?? selected[0])
            : `${selected.length} selected`}
        </span>
        <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 200,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          minWidth: 180,
          maxHeight: 200,
          overflowY: 'auto',
          padding: '4px 0',
        }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                style={{ margin: 0 }}
              />
              {opt.color && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 12, color: 'var(--foreground)' }}>{opt.label}</span>
            </label>
          ))}
          {options.length === 0 && (
            <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--muted-foreground)' }}>No options</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ConditionRowProps {
  condition: FilterCondition
  /** All statuses across all team timelines (deduped by name). */
  statusOptions: { value: string; label: string }[]
  tags: Tag[]
  members: TeamMemberWithUser[]
  onChange: (next: FilterCondition) => void
  onRemove: () => void
}

export default function FilterConditionRow({
  condition,
  statusOptions,
  tags,
  members,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const field = condition.field as FieldValue

  function changeField(newField: FieldValue) {
    onChange(buildCondition(newField))
  }

  function changeOp(op: string) {
    // Keep existing value when switching operators within the same field type.
    const updated = buildCondition(field, op)
    if ('value' in condition && 'value' in updated) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(updated as any).value = (condition as any).value
    }
    onChange(updated as FilterCondition)
  }

  // Operator options for current field
  let opOptions: { value: string; label: string }[] = []
  let currentOp = 'op' in condition ? (condition.op as string) : 'is_true'

  switch (field) {
    case 'status':
    case 'tag':
    case 'assignee':
      opOptions = SET_OPS
      break
    case 'title':
      opOptions = STRING_OPS
      break
    case 'progress':
      opOptions = NUMBER_OPS
      break
    case 'hasParent':
      opOptions = [{ value: 'is_true', label: 'is true' }, { value: 'is_false', label: 'is false' }]
      break
    case 'startDate':
    case 'endDate':
      opOptions = DATE_OPS
      break
  }

  const needsValue = !NO_VALUE_OPS.has(currentOp)

  // Value input component for current field + op
  function renderValue() {
    if (!needsValue) return null

    switch (field) {
      case 'status': {
        const val = (condition as { field: 'status'; op: SetOp; value: string[] }).value ?? []
        return (
          <MultiSelect
            options={statusOptions}
            selected={val}
            onChange={v => onChange({ ...condition, field: 'status', op: (condition as { op: SetOp }).op, value: v })}
            placeholder="Pick statuses…"
          />
        )
      }
      case 'tag': {
        const val = (condition as { field: 'tag'; op: SetOp; value: string[] }).value ?? []
        return (
          <MultiSelect
            options={tags.map(t => ({ value: t.name, label: t.name, color: t.color ?? undefined }))}
            selected={val}
            onChange={v => onChange({ ...condition, field: 'tag', op: (condition as { op: SetOp }).op, value: v })}
            placeholder="Pick tags…"
          />
        )
      }
      case 'assignee': {
        const val = (condition as { field: 'assignee'; op: SetOp; value: string[] }).value ?? []
        return (
          <MultiSelect
            options={members.filter(m => m.userId).map(m => ({ value: m.id, label: m.displayName || m.email || 'Unknown' }))}
            selected={val}
            onChange={v => onChange({ ...condition, field: 'assignee', op: (condition as { op: SetOp }).op, value: v })}
            placeholder="Pick members…"
          />
        )
      }
      case 'title': {
        const val = (condition as { field: 'title'; value: string }).value ?? ''
        return (
          <input
            value={val}
            onChange={e => onChange({ ...condition, field: 'title', op: (condition as { op: StringOp }).op, value: e.target.value })}
            placeholder="Search text…"
            style={{ ...SELECT_STYLE, width: 140 }}
          />
        )
      }
      case 'progress': {
        const val = (condition as { field: 'progress'; value: number }).value ?? 0
        return (
          <input
            type="number"
            min={0}
            max={100}
            value={val}
            onChange={e => onChange({ ...condition, field: 'progress', op: (condition as { op: NumberOp }).op, value: Number(e.target.value) })}
            style={{ ...SELECT_STYLE, width: 70 }}
          />
        )
      }
      case 'startDate':
      case 'endDate': {
        const isBetween = currentOp === 'between'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const val = (condition as any).value ?? ''
        if (isBetween) {
          const [from = '', to = ''] = Array.isArray(val) ? val : [val, '']
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="date" value={from}
                onChange={e => onChange({ ...condition, field, op: 'between' as DateOp, value: [e.target.value, to] } as FilterCondition)}
                style={{ ...SELECT_STYLE, width: 130 }}
              />
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>and</span>
              <input type="date" value={to}
                onChange={e => onChange({ ...condition, field, op: 'between' as DateOp, value: [from, e.target.value] } as FilterCondition)}
                style={{ ...SELECT_STYLE, width: 130 }}
              />
            </div>
          )
        }
        return (
          <input type="date" value={typeof val === 'string' ? val : ''}
            onChange={e => onChange({ ...condition, field, op: currentOp as DateOp, value: e.target.value } as FilterCondition)}
            style={{ ...SELECT_STYLE, width: 140 }}
          />
        )
      }
      default:
        return null
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Field selector */}
      <select value={field} onChange={e => changeField(e.target.value as FieldValue)} style={SELECT_STYLE}>
        {FIELD_OPTIONS.map(f => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select value={currentOp} onChange={e => changeOp(e.target.value)} style={SELECT_STYLE}>
        {opOptions.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input */}
      {renderValue()}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        title="Remove condition"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22,
          height: 22,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          borderRadius: 4,
          flexShrink: 0,
        }}
      >
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  )
}
