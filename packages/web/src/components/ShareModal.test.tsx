/**
 * ShareModal — behavior tests for the share-row footer meta (Phase 13.5):
 * the labeled Created by / Last viewed / View total columns, including the
 * "Never" fallback, the today-as-time vs. older-as-date last-viewed format,
 * and the "· you" marker on own shares. Hooks are module-mocked; this
 * exercises the component contract only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ShareModal from './ShareModal'

// Mutable fixture the useListShares mock returns; tests overwrite per case.
let sharesFixture: unknown[] = []

vi.mock('@/hooks/useShares', () => ({
  useListShares: () => ({ data: sharesFixture, isLoading: false }),
  useCreateShare: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useDeleteShare: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}))

vi.mock('@/hooks/useTeamActivities', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'm-1', userId: 'u-1', displayName: 'Alice' },
      { id: 'm-2', userId: 'u-2', displayName: 'Bob' },
    ],
  }),
}))

// The signed-in user maps to member m-1 (Alice).
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1' } }),
}))

const VIEW_SHARE = {
  id: 'share-1',
  timelineId: 'tl-1',
  token: 'abc123',
  kind: 'view',
  viewType: 'gantt',
  viewConfig: '{}',
  protected: false,
  createdBy: 'm-2',
  createdAt: '2026-01-01T00:00:00Z',
  viewCount: 0,
}

function renderModal() {
  return render(
    <ShareModal
      teamId="team-1"
      timelineId="tl-1"
      viewType="gantt"
      viewConfig={{ groupBy: 'none', sortBy: 'startDate', colorBy: 'member', granularity: 'week', filter: null }}
      onClose={() => {}}
    />,
  )
}

describe('ShareModal share-row footer meta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sharesFixture = []
  })

  it('renders the three labeled meta columns', () => {
    sharesFixture = [VIEW_SHARE]
    renderModal()
    expect(screen.getByText('Created by')).toBeTruthy()
    expect(screen.getByText('Last viewed')).toBeTruthy()
    expect(screen.getByText('View total')).toBeTruthy()
  })

  it('shows "Never" when the share has not been viewed', () => {
    sharesFixture = [{ ...VIEW_SHARE, lastViewedAt: undefined }]
    renderModal()
    expect(screen.getByText('Never')).toBeTruthy()
  })

  it('shows the time of day when the last view was today', () => {
    const now = new Date()
    sharesFixture = [{ ...VIEW_SHARE, lastViewedAt: now.toISOString(), viewCount: 4 }]
    renderModal()
    const expected = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('shows a short date when the last view was on an earlier day', () => {
    const past = new Date('2026-01-05T10:00:00Z')
    sharesFixture = [{ ...VIEW_SHARE, lastViewedAt: past.toISOString(), viewCount: 4 }]
    renderModal()
    const expected = past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    expect(screen.getByText(expected)).toBeTruthy()
    expect(screen.queryByText('Never')).toBeNull()
  })

  it('shows the view total', () => {
    sharesFixture = [{ ...VIEW_SHARE, viewCount: 7 }]
    renderModal()
    expect(screen.getByText('7')).toBeTruthy()
  })

  it("names the creator, with a '· you' marker only on the current member's shares", () => {
    sharesFixture = [
      { ...VIEW_SHARE, id: 'share-bob', createdBy: 'm-2' },
      { ...VIEW_SHARE, id: 'share-own', createdBy: 'm-1' },
    ]
    renderModal()
    expect(screen.getByText('Bob')).toBeTruthy()
    // Alice's row carries the marker; Bob's does not — exactly one in the list.
    expect(screen.getAllByText('· you')).toHaveLength(1)
    expect(screen.getByText('Alice').textContent).toContain('Alice')
  })
})
