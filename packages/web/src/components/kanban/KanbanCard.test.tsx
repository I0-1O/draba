/**
 * KanbanCard — interactive=false tests (Phase 13.3 public share viewer).
 *
 * The public Kanban share renders cards with `interactive={false}`: clicks,
 * keyboard activation, drag, and the hierarchy-toggle chevron must all be
 * inert so a read-only viewer can't trigger app state changes.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KanbanCard from './KanbanCard'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']

const activity: ApiActivity = {
  id: 'act-1',
  timelineId: 'tl-1',
  title: 'Draft proposal',
  startAt: '2026-06-01T00:00:00Z',
  endAt: '2026-06-05T00:00:00Z',
  allDay: true,
  statusId: null,
  description: null,
  notes: null,
  color: null,
  icon: null,
  location: null,
  url: null,
  parentActivityId: null,
  percentComplete: 0,
  assignedMemberIds: [],
  tagIds: [],
  archivedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

function baseProps(overrides: Partial<React.ComponentProps<typeof KanbanCard>> = {}) {
  return {
    activity,
    accentColor: '#3B82F6',
    members: [],
    statusById: new Map(),
    tagById: new Map(),
    cardFields: ['status' as const],
    suppressedFields: new Set<never>(),
    isSelected: false,
    dimmed: false,
    activeMatch: false,
    onClick: vi.fn(),
    ...overrides,
  }
}

describe('KanbanCard interactive=false', () => {
  it('renders without a button role, tabIndex, or click handler', () => {
    render(<KanbanCard {...baseProps({ interactive: false })} />)
    const card = screen.getByText('Draft proposal').closest('div[style*="border-left"]')!
    expect(card.getAttribute('role')).toBeNull()
    expect(card.getAttribute('tabindex')).toBeNull()
  })

  it('does not invoke onClick when clicked or activated via keyboard', () => {
    const onClick = vi.fn()
    render(<KanbanCard {...baseProps({ interactive: false, onClick })} />)
    const card = screen.getByText('Draft proposal').closest('div[style*="border-left"]')!
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hides the hierarchy-toggle chevron click handler', () => {
    const onToggleHierarchy = vi.fn()
    render(
      <KanbanCard
        {...baseProps({ interactive: false, hasHierarchyChildren: true, onToggleHierarchy })}
      />,
    )
    const chevronButton = screen.getByTitle('Collapse children')
    fireEvent.click(chevronButton)
    expect(onToggleHierarchy).not.toHaveBeenCalled()
  })
})

describe('KanbanCard interactive=true (default)', () => {
  it('exposes a button role and invokes onClick', () => {
    const onClick = vi.fn()
    render(<KanbanCard {...baseProps({ onClick })} />)
    const card = screen.getByRole('button')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
