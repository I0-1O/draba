/**
 * KanbanColumn — interactive=false tests (Phase 13.3 public share viewer).
 *
 * The public Kanban share renders columns with `interactive={false}`: the
 * "Collapse column" toggle and the "+ Add" affordance must not render, and
 * the collapsed-rail click-to-expand must be inert — none of these can be
 * allowed to mutate app state from a read-only public link.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import KanbanColumn from './KanbanColumn'
import type { KanbanColumn as Column } from './kanbanColumns'
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

const column: Column = {
  id: 'col-1',
  label: 'In Progress',
  droppable: true,
  items: [activity],
}

function baseProps(overrides: Partial<React.ComponentProps<typeof KanbanColumn>> = {}) {
  return {
    column,
    members: [],
    statusById: new Map(),
    tagById: new Map(),
    colorMap: new Map(),
    activityTitleById: new Map(),
    cardFields: ['status' as const],
    suppressedFields: new Set<never>(),
    selectedActivityId: null,
    matchedIds: new Set<string>(),
    activeMatchId: null,
    hasQuery: false,
    isOver: false,
    isCollapsed: false,
    onToggleCollapse: vi.fn(),
    onCardClick: vi.fn(),
    onAddClick: vi.fn(),
    showHierarchy: false,
    childrenByParentId: new Map(),
    collapsedParents: new Set<string>(),
    onToggleParent: vi.fn(),
    ...overrides,
  }
}

describe('KanbanColumn interactive=false', () => {
  it('hides the collapse toggle and the + Add affordance', () => {
    render(<KanbanColumn {...baseProps({ interactive: false })} />)
    expect(screen.queryByTitle('Collapse column')).toBeNull()
    expect(screen.queryByText('Add')).toBeNull()
  })

  it('does not invoke onToggleCollapse when the collapsed rail is clicked', () => {
    const onToggleCollapse = vi.fn()
    render(<KanbanColumn {...baseProps({ interactive: false, isCollapsed: true, onToggleCollapse })} />)
    const rail = screen.getByTitle('In Progress (1)')
    fireEvent.click(rail)
    expect(onToggleCollapse).not.toHaveBeenCalled()
  })
})

describe('KanbanColumn interactive=true (default)', () => {
  it('shows the collapse toggle and the + Add affordance', () => {
    render(<KanbanColumn {...baseProps()} />)
    expect(screen.getByTitle('Collapse column')).toBeTruthy()
    expect(screen.getByText('Add')).toBeTruthy()
  })

  it('invokes onToggleCollapse when the collapsed rail is clicked', () => {
    const onToggleCollapse = vi.fn()
    render(<KanbanColumn {...baseProps({ isCollapsed: true, onToggleCollapse })} />)
    fireEvent.click(screen.getByTitle('In Progress (1)'))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })
})
