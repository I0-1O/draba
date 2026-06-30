/**
 * CleanSnapshot — smoke tests for the three off-screen, interactive=false
 * render targets used by the PNG export capture (Phase 14.3). Each view
 * reuses an existing interactive=false-capable component (GanttGrid,
 * PublicListTable, KanbanBoard); these tests confirm CleanSnapshot wires the
 * live activity/member/status data into those components correctly and that
 * the resulting DOM reflects the given data, not just that it doesn't throw.
 */

import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CleanGanttSnapshot, CleanListSnapshot, CleanKanbanSnapshot } from './CleanSnapshot'
import type { Member } from '@/types'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']
type Status = components['schemas']['Status']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']
type Tag = components['schemas']['Tag']

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ApiActivity> & { id: string }): ApiActivity {
  return {
    id: overrides.id,
    title: overrides.title ?? `Activity ${overrides.id}`,
    timelineId: 'tl1',
    startAt: overrides.startAt ?? '2026-01-05T00:00:00Z',
    endAt: overrides.endAt ?? '2026-01-09T00:00:00Z',
    color: overrides.color ?? '#288C9B',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00Z',
    assignedMemberIds: overrides.assignedMemberIds ?? [],
    tagIds: overrides.tagIds ?? [],
    percentComplete: overrides.percentComplete ?? null,
    archivedAt: null,
    description: overrides.description ?? null,
    icon: overrides.icon ?? null,
    location: overrides.location ?? null,
    notes: overrides.notes ?? null,
    statusId: overrides.statusId ?? null,
    parentActivityId: overrides.parentActivityId ?? null,
    url: overrides.url ?? null,
  } as ApiActivity
}

function makeStatus(id: string, name: string, position: number, color = '#288C9B'): Status {
  return { id, name, position, color, icon: null, isClosed: false, timelineId: 'tl1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } as Status
}

function makeMember(id: string, name: string): Member {
  return { id, name, initials: name.slice(0, 2).toUpperCase(), color: '#8b949e' }
}

function makeTeamMember(id: string, displayName: string): TeamMemberWithUser {
  return { id, displayName, email: `${id}@test.com`, role: 'member', userId: id, color: null, icon: null, archivedAt: null, joinedAt: '2026-01-01T00:00:00Z', teamId: 'team1' } as unknown as TeamMemberWithUser
}

const statuses = [makeStatus('s1', 'Planned', 0), makeStatus('s2', 'Done', 1, '#22c55e')]
const tags: Tag[] = []

describe('CleanGanttSnapshot', () => {
  it('renders the given activities as gantt rows', () => {
    const activities = [makeActivity({ id: 'a1', title: 'Design review' })]
    render(
      <CleanGanttSnapshot
        activities={activities}
        members={[makeMember('m1', 'Alice')]}
        statuses={statuses}
        groupBy="none"
        sortBy="title"
        colorBy="activity"
        granularity="week"
        startDate="2026-01-01T00:00:00Z"
        endDate="2026-02-01T00:00:00Z"
        weekStart="monday"
        locale="en-US"
      />,
    )
    // The activity title renders twice (sticky left-rail label + bar label).
    expect(screen.getAllByText('Design review').length).toBeGreaterThan(0)
  })

  it('drops activities outside the generated column range without throwing', () => {
    const activities = [makeActivity({ id: 'a1', title: 'Out of range', startAt: '2020-01-01T00:00:00Z', endAt: '2020-01-02T00:00:00Z' })]
    expect(() =>
      render(
        <CleanGanttSnapshot
          activities={activities}
          members={[]}
          statuses={statuses}
          groupBy="status"
          sortBy="startDate"
          colorBy="status"
          granularity="month"
          startDate="2026-01-01T00:00:00Z"
          endDate="2026-03-01T00:00:00Z"
          weekStart="sunday"
          locale="en-US"
        />,
      ),
    ).not.toThrow()
    expect(screen.queryByText('Out of range')).not.toBeInTheDocument()
  })
})

describe('CleanListSnapshot', () => {
  it('renders one row per activity with the default visible columns', () => {
    const activities = [
      makeActivity({ id: 'a1', title: 'Write spec' }),
      makeActivity({ id: 'a2', title: 'Ship feature' }),
    ]
    render(
      <CleanListSnapshot
        activities={activities}
        members={[makeTeamMember('m1', 'Bob')]}
        statuses={statuses}
        tags={tags}
        groupBy="none"
        sortBy="title"
        columns={null}
      />,
    )
    expect(screen.getByText('Write spec')).toBeInTheDocument()
    expect(screen.getByText('Ship feature')).toBeInTheDocument()
  })

  it('only renders the explicitly visible columns', () => {
    const activities = [makeActivity({ id: 'a1', title: 'Solo task' })]
    render(
      <CleanListSnapshot
        activities={activities}
        members={[]}
        statuses={statuses}
        tags={tags}
        groupBy="none"
        sortBy="title"
        columns={[{ id: 'title', visible: true }]}
      />,
    )
    // Only the title column was requested — no status column header should render.
    expect(screen.getByText('Solo task')).toBeInTheDocument()
    expect(screen.queryByText('Status')).not.toBeInTheDocument()
  })
})

describe('CleanKanbanSnapshot', () => {
  it('places each activity card under its status column', () => {
    const activities = [
      makeActivity({ id: 'a1', title: 'Backlog item', statusId: 's1' }),
      makeActivity({ id: 'a2', title: 'Finished item', statusId: 's2' }),
    ]
    render(
      <CleanKanbanSnapshot
        activities={activities}
        teamMembers={[makeTeamMember('m1', 'Carol')]}
        members={[makeMember('m1', 'Carol')]}
        statuses={statuses}
        tags={tags}
        groupBy="status"
        sortBy="title"
        colorBy="status"
        cardFields={['dateRange', 'status']}
        showHierarchy={false}
        collapsedColumnIds={[]}
      />,
    )
    // Status names appear twice each (column header + the card's status field).
    expect(screen.getAllByText('Planned').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0)
    expect(screen.getByText('Backlog item')).toBeInTheDocument()
    expect(screen.getByText('Finished item')).toBeInTheDocument()
  })

  it('hides children behind their parent when showHierarchy is true', () => {
    const activities = [
      makeActivity({ id: 'parent', title: 'Parent task', statusId: 's1' }),
      makeActivity({ id: 'child', title: 'Child task', statusId: 's1', parentActivityId: 'parent' }),
    ]
    render(
      <CleanKanbanSnapshot
        activities={activities}
        teamMembers={[]}
        members={[]}
        statuses={statuses}
        tags={tags}
        groupBy="status"
        sortBy="title"
        colorBy="status"
        cardFields={[]}
        showHierarchy
        collapsedColumnIds={[]}
      />,
    )
    expect(screen.getByText('Parent task')).toBeInTheDocument()
    // The child renders nested under the parent card (expanded by default in
    // the snapshot) but is excluded from the column's top-level activity list,
    // so it should appear exactly once rather than once per place.
    expect(screen.getAllByText('Child task')).toHaveLength(1)
  })
})
