/**
 * FilterConditionRow.test.tsx — unit tests for the single condition builder row.
 *
 * The component is pure-props (no API calls), so tests run without mocks.
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FilterConditionRow from './FilterConditionRow'
import type { ConditionRowProps } from './FilterConditionRow'
import type { components } from '@draba/shared'

type Tag = components['schemas']['Tag']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

function makeTag(id: string, name: string): Tag {
  return { id, name, color: null, teamId: 'team-1', createdAt: '2026-01-01T00:00:00Z', createdBy: 'user-1' }
}

const defaultProps: ConditionRowProps = {
  condition: { field: 'title', op: 'contains', value: '' },
  statusOptions: [{ value: 'Open', label: 'Open' }, { value: 'Done', label: 'Done' }],
  tags: [makeTag('tag-1', 'bug'), makeTag('tag-2', 'feature')],
  members: [] as TeamMemberWithUser[],
  onChange: vi.fn(),
  onRemove: vi.fn(),
}

describe('FilterConditionRow', () => {
  it('renders the field selector with the current field selected', () => {
    render(<FilterConditionRow {...defaultProps} />)
    const fieldSelect = screen.getByDisplayValue('Title')
    expect(fieldSelect).toBeInTheDocument()
  })

  it('renders the operator selector for the current field', () => {
    render(<FilterConditionRow {...defaultProps} />)
    // 'contains' is the default op for title
    expect(screen.getByDisplayValue('contains')).toBeInTheDocument()
  })

  it('renders a text input for title+contains', () => {
    render(<FilterConditionRow {...defaultProps} />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('calls onChange when the field changes', () => {
    const onChange = vi.fn()
    render(<FilterConditionRow {...defaultProps} onChange={onChange} />)
    const fieldSelect = screen.getByDisplayValue('Title')
    fireEvent.change(fieldSelect, { target: { value: 'status' } })
    expect(onChange).toHaveBeenCalledOnce()
    const newCondition = onChange.mock.calls[0][0]
    expect(newCondition.field).toBe('status')
  })

  it('calls onChange when the operator changes', () => {
    const onChange = vi.fn()
    render(<FilterConditionRow {...defaultProps} onChange={onChange} />)
    const opSelect = screen.getByDisplayValue('contains')
    fireEvent.change(opSelect, { target: { value: 'equals' } })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].op).toBe('equals')
  })

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn()
    render(<FilterConditionRow {...defaultProps} onRemove={onRemove} />)
    // The remove button renders an X icon; find by its aria-label or by querying role
    const removeBtn = screen.getByRole('button')
    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('hides the value input for is_empty operator', () => {
    render(<FilterConditionRow
      {...defaultProps}
      condition={{ field: 'title', op: 'is_empty', value: '' }}
    />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('renders progress number input when field is progress', () => {
    render(<FilterConditionRow
      {...defaultProps}
      condition={{ field: 'progress', op: 'gte', value: 0 }}
    />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('renders date input when field is startDate', () => {
    render(<FilterConditionRow
      {...defaultProps}
      condition={{ field: 'startDate', op: 'before', value: '' }}
    />)
    // date input renders as a generic input without explicit role
    const dateInput = screen.getByDisplayValue('')
    expect(dateInput).toHaveAttribute('type', 'date')
  })
})
