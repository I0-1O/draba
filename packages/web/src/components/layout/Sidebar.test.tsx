/**
 * Sidebar — behavior tests for the timeline tile's active-share-count chip
 * (Phase 13.5): rendered with the count when a timeline has live share links,
 * hidden at zero or when the API omits the field, singular/plural tooltip.
 *
 * Also covers the Phase 14.3-adjacent member-nesting fix: the Members section
 * renders directly under the active team's row (not after the whole team
 * list), and switching the active team moves it without duplicating it.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}))

function renderSidebar(apiTimelines: { id: string; name: string; shareCount?: number }[]) {
  return render(
    <Sidebar collapsed={false} onToggle={() => {}} apiTimelines={apiTimelines} />,
  )
}

describe('Sidebar share-count chip', () => {
  it('shows a chip with the count on timelines that have active shares', () => {
    renderSidebar([{ id: 'tl-1', name: 'Q1 Plan', shareCount: 3 }])
    const chip = screen.getByTitle('3 active share links')
    expect(chip.textContent).toBe('3')
  })

  it('uses the singular form for a single share link', () => {
    renderSidebar([{ id: 'tl-1', name: 'Q1 Plan', shareCount: 1 }])
    expect(screen.getByTitle('1 active share link')).toBeTruthy()
  })

  it('hides the chip when the count is zero or the field is absent', () => {
    renderSidebar([
      { id: 'tl-1', name: 'Q1 Plan', shareCount: 0 },
      { id: 'tl-2', name: 'Q2 Plan' },
    ])
    expect(screen.queryAllByTitle(/active share link/)).toHaveLength(0)
  })
})

describe('Sidebar member nesting under the active team', () => {
  const teamA = { id: 'team-a', name: 'Team Alpha' }
  const teamB = { id: 'team-b', name: 'Team Beta' }
  const members = [
    { id: 'm1', displayName: 'Alice', userId: 'u1', color: null, icon: null, archivedAt: null } as never,
  ]

  it('renders the Members section between the active team row and the next team row', () => {
    render(
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        activeTeam={teamA}
        activeTeams={[teamA, teamB]}
        members={members}
      />,
    )

    const teamARow = screen.getByText('Team Alpha')
    const teamBRow = screen.getByText('Team Beta')
    const membersHeading = screen.getByText('Members')
    const aliceRow = screen.getByText('Alice')

    // DOCUMENT_POSITION_FOLLOWING (4) means the left node comes before the right one.
    expect(teamARow.compareDocumentPosition(membersHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(membersHeading.compareDocumentPosition(teamBRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(membersHeading.compareDocumentPosition(aliceRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not render a Members section under an inactive team row', () => {
    render(
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        activeTeam={teamA}
        activeTeams={[teamA, teamB]}
        members={members}
      />,
    )
    // Only one Members section total — not one per team in the switchable list.
    expect(screen.getAllByText('Members')).toHaveLength(1)
  })

  it('renders Members under the fallback active-team row when activeTeams has not loaded yet', () => {
    render(
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        activeTeam={teamA}
        activeTeams={[]}
        members={members}
      />,
    )
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
