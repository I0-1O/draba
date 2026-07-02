/**
 * CalendarGrid — interactive=false tests (Phase 14.4 clean export snapshot).
 *
 * `CleanCalendarSnapshot` renders the grid with `interactive={false}` inside
 * the off-screen PresentationFrame: bar clicks, bar drags, cell clicks, and
 * the month row-height resize handle must all be inert — an export render
 * can never be allowed to select activities or mutate dates. Mirrors the
 * KanbanCard/KanbanColumn interactive=false suites from Phase 13.3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarGrid from './CalendarGrid'
import type { WeekRow, CalendarSegment } from '@/lib/calendarLanes'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']

const activity: ApiActivity = {
  id: 'act-1',
  timelineId: 'tl-1',
  title: 'Draft proposal',
  startAt: '2026-06-01T00:00:00Z',
  endAt: '2026-06-03T00:00:00Z',
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

const segment: CalendarSegment = {
  activityId: 'act-1',
  startCol: 0,
  endCol: 2,
  lane: 0,
  continuesLeft: false,
  continuesRight: false,
  color: '#ef4444',
  title: 'Draft proposal',
  assignedMemberIds: [],
  isMatch: false,
  isActiveMatch: false,
}

function makeWeek(): WeekRow {
  const weekStart = new Date('2026-06-01T00:00:00Z')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    return d
  })
  return { weekStart, days, segments: [segment], laneCount: 1, visibleLaneCap: 3 }
}

function baseProps(overrides: Partial<React.ComponentProps<typeof CalendarGrid>> = {}) {
  return {
    weeks: [makeWeek()],
    layout: 'month' as const,
    weekStartDay: 1 as const,
    activityById: new Map([[activity.id, activity]]),
    memberById: {},
    selectedActivityId: null,
    hasQuery: false,
    today: new Date('2026-06-01T00:00:00Z'),
    onSelectActivity: vi.fn(),
    onCellClick: vi.fn(),
    onBarDragProgress: vi.fn(),
    onBarDragEnd: vi.fn(),
    onBarDragCommit: vi.fn(),
    onCapDraft: vi.fn(),
    onCapCommit: vi.fn(),
    ...overrides,
  }
}

// jsdom has no layout, so document.elementsFromPoint (used by the drag code to
// find the day cell under the cursor) doesn't exist — stub it to a fixed day
// so drag handlers that get past the interactive guard behave deterministically.
beforeEach(() => {
  document.elementsFromPoint = vi.fn(() => [
    { dataset: { date: '2026-06-04' } } as unknown as Element,
  ])
})

describe('CalendarGrid interactive=false', () => {
  it('does not select an activity when a bar is clicked', () => {
    const onSelectActivity = vi.fn()
    render(<CalendarGrid {...baseProps({ interactive: false, onSelectActivity })} />)
    fireEvent.click(screen.getByText('Draft proposal'))
    expect(onSelectActivity).not.toHaveBeenCalled()
  })

  it('does not start a drag on bar pointerdown', () => {
    const onBarDragProgress = vi.fn()
    render(<CalendarGrid {...baseProps({ interactive: false, onBarDragProgress })} />)
    fireEvent.pointerDown(screen.getByText('Draft proposal'), { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(document, { clientX: 60, clientY: 10 })
    expect(onBarDragProgress).not.toHaveBeenCalled()
  })

  it('does not invoke onCellClick when a day cell is clicked', () => {
    const onCellClick = vi.fn()
    const { container } = render(<CalendarGrid {...baseProps({ interactive: false, onCellClick })} />)
    const cell = container.querySelector('[data-date="2026-06-02"]')
    expect(cell).not.toBeNull()
    fireEvent.click(cell!)
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('does not render the month row-height resize handle', () => {
    render(<CalendarGrid {...baseProps({ interactive: false })} />)
    expect(screen.queryByTitle('Drag to show more or fewer activities')).toBeNull()
  })
})

describe('CalendarGrid interactive=true (default)', () => {
  it('selects the activity when a bar is clicked', () => {
    const onSelectActivity = vi.fn()
    render(<CalendarGrid {...baseProps({ onSelectActivity })} />)
    fireEvent.click(screen.getByText('Draft proposal'))
    expect(onSelectActivity).toHaveBeenCalledWith(activity)
  })

  it('reports drag progress on bar pointerdown + pointermove', () => {
    const onBarDragProgress = vi.fn()
    render(<CalendarGrid {...baseProps({ onBarDragProgress })} />)
    fireEvent.pointerDown(screen.getByText('Draft proposal'), { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(document, { clientX: 60, clientY: 10 })
    expect(onBarDragProgress).toHaveBeenCalled()
  })

  it('invokes onCellClick when a day cell is clicked', () => {
    const onCellClick = vi.fn()
    const { container } = render(<CalendarGrid {...baseProps({ onCellClick })} />)
    fireEvent.click(container.querySelector('[data-date="2026-06-02"]')!)
    expect(onCellClick).toHaveBeenCalledTimes(1)
  })

  it('renders the month row-height resize handle', () => {
    render(<CalendarGrid {...baseProps()} />)
    expect(screen.getByTitle('Drag to show more or fewer activities')).toBeTruthy()
  })
})
