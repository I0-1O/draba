/**
 * CalendarShareModal — behavior tests for the ICS feed configurator: the
 * public-access toggle creates/deletes the feed for the selected scope, the
 * feed URL + subscribe links render when on, and Regenerate rotates the token.
 * Hooks are module-mocked; this exercises the component contract only.
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

  it('shows the toggle off and no feed URL when no ICS share exists', () => {
    renderModal()
    expect(screen.getByRole('switch', { name: /public calendar feed/i }).getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByText(/\.ics/)).toBeNull()
  })

  it('creates a whole-timeline feed when toggled on', () => {
    renderModal()
    fireEvent.click(screen.getByRole('switch', { name: /public calendar feed/i }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ics', scope: 'timeline' }),
    )
  })

  it('creates a member feed for the selected member', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'One member' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Member' }), { target: { value: 'm-2' } })
    fireEvent.click(screen.getByRole('switch', { name: /public calendar feed/i }))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ics', scope: 'member', memberId: 'm-2' }),
    )
  })

  it('renders the feed URL and subscribe links when the feed is on', () => {
    sharesFixture = [ICS_TIMELINE_SHARE]
    renderModal()
    expect(screen.getByRole('switch', { name: /public calendar feed/i }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText(/\/shares\/feed-token\.ics$/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Add to Google' }).getAttribute('href')).toContain('calendar.google.com')
    expect(screen.getByRole('link', { name: 'Add to Apple' }).getAttribute('href')).toMatch(/^webcal:\/\//)
    expect(screen.getByRole('link', { name: 'Add to Outlook' }).getAttribute('href')).toContain('outlook.live.com')
  })

  it('deletes the feed when toggled off', () => {
    sharesFixture = [ICS_TIMELINE_SHARE]
    renderModal()
    fireEvent.click(screen.getByRole('switch', { name: /public calendar feed/i }))
    expect(mockDelete).toHaveBeenCalledWith('share-ics-1')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('regenerates the link for the active feed', () => {
    sharesFixture = [ICS_TIMELINE_SHARE]
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: /regenerate link/i }))
    expect(mockRegenerate).toHaveBeenCalledWith('share-ics-1')
  })

  it('ignores view shares when resolving the active feed', () => {
    sharesFixture = [{ ...ICS_TIMELINE_SHARE, id: 'view-1', kind: 'view', scope: undefined }]
    renderModal()
    expect(screen.getByRole('switch', { name: /public calendar feed/i }).getAttribute('aria-checked')).toBe('false')
  })
})
