/**
 * CalendarShareModal — behavior tests for the ICS feed list: one toggle row
 * per feed (whole timeline + each member), toggling creates/deletes the right
 * feed, the URL + subscribe links render only for rows that are on, and
 * Regenerate rotates the right share. Hooks are module-mocked; this exercises
 * the component contract only.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CalendarShareModal from './CalendarShareModal'

const mockCreate = vi.fn()
const mockDelete = vi.fn()
const mockRegenerate = vi.fn()

// Mutable fixture the useListShares mock returns; tests overwrite per case.
let sharesFixture: unknown[] = []

vi.mock('@/hooks/useShares', () => ({
  useListShares: () => ({ data: sharesFixture, isLoading: false }),
  useCreateShare: () => ({ mutate: mockCreate, isPending: false, isError: false }),
  useDeleteShare: () => ({ mutate: mockDelete, isPending: false, isError: false }),
  useRegenerateShare: () => ({ mutate: mockRegenerate, isPending: false, isError: false }),
}))

vi.mock('@/hooks/useTeamActivities', () => ({
  useTeamMembers: () => ({
    data: [
      { id: 'm-1', displayName: 'Alice' },
      { id: 'm-2', displayName: 'Bob' },
    ],
  }),
}))

const ICS_TIMELINE_SHARE = {
  id: 'share-ics-1',
  timelineId: 'tl-1',
  token: 'feed-token',
  kind: 'ics',
  scope: 'timeline',
  name: 'Q1 calendar feed',
  viewType: 'calendar',
  viewConfig: '{}',
  protected: false,
  createdBy: 'm-1',
  createdAt: '2026-01-01T00:00:00Z',
  viewCount: 0,
}

const ICS_MEMBER_SHARE = {
  ...ICS_TIMELINE_SHARE,
  id: 'share-ics-2',
  token: 'member-feed-token',
  scope: 'member',
  memberId: 'm-2',
  name: 'Bob calendar feed',
}

function renderModal() {
  return render(
    <CalendarShareModal teamId="team-1" timelineId="tl-1" timelineName="Q1" onClose={() => {}} />,
  )
}

describe('CalendarShareModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sharesFixture = []
  })

  it('renders one toggle row for the timeline and one per member, all off by default', () => {
    renderModal()
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(3)
    expect(screen.getByRole('switch', { name: 'Whole timeline feed' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Alice feed' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Bob feed' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText(/\.ics/)).toBeNull()
  })

  it('creates a whole-timeline feed when its row is toggled on', () => {
    renderModal()
    fireEvent.click(screen.getByRole('switch', { name: 'Whole timeline feed' }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ics', scope: 'timeline' }),
    )
  })

  it("creates a member feed when that member's row is toggled on", () => {
    renderModal()
    fireEvent.click(screen.getByRole('switch', { name: 'Bob feed' }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ics', scope: 'member', memberId: 'm-2' }),
    )
  })

  it('shows the URL + subscribe links only on rows that are on', () => {
    sharesFixture = [ICS_TIMELINE_SHARE, ICS_MEMBER_SHARE]
    renderModal()
    expect(screen.getByRole('switch', { name: 'Whole timeline feed' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Bob feed' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('switch', { name: 'Alice feed' }).getAttribute('aria-checked')).toBe('false')

    // Readable slug filename — calendar clients default the calendar's name
    // from the URL filename, so it must not be the bare token hash.
    expect(screen.getByText(/\/shares\/feed-token\/q1-calendar-feed\.ics$/)).toBeTruthy()
    expect(screen.getByText(/\/shares\/member-feed-token\/bob-calendar-feed\.ics$/)).toBeTruthy()

    const googleLinks = screen.getAllByRole('link', { name: 'Google' })
    expect(googleLinks).toHaveLength(2)
    expect(googleLinks[0].getAttribute('href')).toContain('calendar.google.com')
    expect(screen.getAllByRole('link', { name: 'Apple' })[0].getAttribute('href')).toMatch(/^webcal:\/\//)
    expect(screen.getAllByRole('link', { name: 'Outlook' })[0].getAttribute('href')).toContain('outlook.live.com')
  })

  it('deletes the right feed when its row is toggled off', () => {
    sharesFixture = [ICS_TIMELINE_SHARE, ICS_MEMBER_SHARE]
    renderModal()
    fireEvent.click(screen.getByRole('switch', { name: 'Bob feed' }))
    expect(mockDelete).toHaveBeenCalledWith('share-ics-2')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('regenerates the link for the right feed', () => {
    sharesFixture = [ICS_TIMELINE_SHARE, ICS_MEMBER_SHARE]
    renderModal()
    const regenButtons = screen.getAllByRole('button', { name: /regenerate link/i })
    expect(regenButtons).toHaveLength(2)
    fireEvent.click(regenButtons[1])
    expect(mockRegenerate).toHaveBeenCalledWith('share-ics-2')
  })

  it('ignores view shares when resolving feed state', () => {
    sharesFixture = [{ ...ICS_TIMELINE_SHARE, id: 'view-1', kind: 'view', scope: undefined }]
    renderModal()
    expect(screen.getByRole('switch', { name: 'Whole timeline feed' }).getAttribute('aria-checked')).toBe('false')
  })
})
