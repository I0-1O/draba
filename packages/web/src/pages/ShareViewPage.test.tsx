/**
 * PublicListTable — read-only renderer for List shares (Phase 13.3).
 *
 * Exercises the rendering paths that the public gateway depends on: group
 * headers, status/notes/tags cells, the empty state, and that the table never
 * exposes a column the share creator left hidden (mirrors the backend
 * notesEnabled gate in share_handler.go).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicListTable } from './ShareViewPage'
import { COL_CATALOG, type ListDisplayRow, type ColMeta } from '@/components/list/ListView'
import type { components } from '@draba/shared'

type ApiActivity = components['schemas']['Activity']
type PublicMember = components['schemas']['PublicMember']
type Status = components['schemas']['Status']
type Tag = components['schemas']['Tag']

const colsById = new Map(COL_CATALOG.map(c => [c.id, c]))
function cols(...ids: string[]): ColMeta[] {
  return ids.map(id => colsById.get(id)!)
}

const activity: ApiActivity = {
  id: 'act-1',
  timelineId: 'tl-1',
  title: 'Ship the launch deck',
  startAt: '2026-06-01T00:00:00Z',
  endAt: '2026-06-05T00:00:00Z',
  allDay: true,
  statusId: 'status-1',
  description: null,
  notes: 'Confidential rollout notes',
  color: null,
  icon: null,
  location: null,
  url: null,
  parentActivityId: null,
  percentComplete: 40,
  assignedMemberIds: ['member-1'],
  tagIds: ['tag-1'],
  archivedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

const member: PublicMember = { id: 'member-1', displayName: 'Asha Patel', color: 'blue', icon: null }
const status: Status = { id: 'status-1', timelineId: 'tl-1', name: 'In Progress', color: '#3B82F6' }
const tag: Tag = { id: 'tag-1', teamId: 'team-1', name: 'launch', color: 'red', createdBy: 'user-1', createdAt: '2026-01-01T00:00:00Z' }

const memberById = new Map([[member.id, member]])
const statusById = new Map([[status.id, status]])
const tagById = new Map([[tag.id, tag]])
const activityTitleById = new Map([[activity.id, activity.title]])

const groupRow: ListDisplayRow = { kind: 'group', key: 'g1', label: 'In Progress', count: 1 }
const activityRow: ListDisplayRow = { kind: 'activity', activity, depth: 0, hasChildren: false, groupKey: 'g1' }

function renderTable(rows: ListDisplayRow[], visibleColumns: ColMeta[]) {
  return render(
    <PublicListTable
      rows={rows}
      visibleColumns={visibleColumns}
      memberById={memberById}
      statusById={statusById}
      tagById={tagById}
      activityTitleById={activityTitleById}
    />,
  )
}

describe('PublicListTable', () => {
  it('renders group headers with their label and count', () => {
    renderTable([groupRow, activityRow], cols('title', 'status'))
    // "In Progress" appears twice: once as the group label, once as the row's status badge.
    expect(screen.getAllByText('In Progress')).toHaveLength(2)
    expect(screen.getByText('(1)')).toBeTruthy()
  })

  it('renders activity rows with title, status, assignees, and tags', () => {
    renderTable([activityRow], cols('title', 'status', 'assignees', 'tags'))
    expect(screen.getByText('Ship the launch deck')).toBeTruthy()
    expect(screen.getByText('In Progress')).toBeTruthy()
    expect(screen.getByTitle('Asha Patel')).toBeTruthy()
    expect(screen.getByText('launch')).toBeTruthy()
  })

  it('shows the notes cell only when the Notes column is in the visible set', () => {
    const { rerender } = renderTable([activityRow], cols('title', 'notes'))
    expect(screen.getByText('Confidential rollout notes')).toBeTruthy()

    rerender(
      <PublicListTable
        rows={[activityRow]}
        visibleColumns={cols('title')}
        memberById={memberById}
        statusById={statusById}
        tagById={tagById}
        activityTitleById={activityTitleById}
      />,
    )
    expect(screen.queryByText('Confidential rollout notes')).toBeNull()
  })

  it('renders the empty state when there are no rows', () => {
    renderTable([], cols('title', 'status'))
    expect(screen.getByText('No activities to show.')).toBeTruthy()
  })

  it('renders one header cell per visible column, in order', () => {
    renderTable([activityRow], cols('title', 'startAt', 'endAt'))
    const headers = screen.getAllByRole('columnheader')
    expect(headers.map(h => h.textContent)).toEqual(['Title', 'Start', 'End'])
  })
})
