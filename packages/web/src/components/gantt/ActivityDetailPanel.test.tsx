/**
 * ActivityDetailPanel — focused tests for the notes field added in Phase 10.4.4.
 *
 * We mock the two data hooks so the test stays fast and offline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityDetailPanel from './ActivityDetailPanel'

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockMutate = vi.fn()

vi.mock('@/hooks/useTeamActivities', () => ({
  useUpdateActivity: () => ({ mutate: mockMutate, isPending: false }),
  useDeleteActivity: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useStatusTemplates', () => ({
  useTimelineStatuses: () => ({ data: [] }),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseActivity = {
  id: 'act-1',
  title: 'Test Activity',
  startAt: '2026-06-01T00:00:00Z',
  endAt: '2026-06-05T00:00:00Z',
  timelineId: 'tl-1',
  statusId: null,
  description: null,
  notes: null,
  color: null,
  icon: null,
  location: null,
  url: null,
  parentActivityId: null,
  archivedAt: null,
  assignedUserIds: [],
}

function renderPanel(overrides: Partial<typeof baseActivity> = {}) {
  const event = { ...baseActivity, ...overrides }
  return render(
    <ActivityDetailPanel
      event={event}
      open={true}
      members={[]}
      teamId="team-1"
      timelineId="tl-1"
      onClose={vi.fn()}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActivityDetailPanel — notes field', () => {
  beforeEach(() => mockMutate.mockClear())

  it('renders the Notes textarea', () => {
    renderPanel()
    expect(screen.getByPlaceholderText('Add notes…')).toBeTruthy()
  })

  it('pre-fills the textarea with existing notes', () => {
    renderPanel({ notes: 'Remember to sync with design.' })
    const textarea = screen.getByPlaceholderText('Add notes…') as HTMLTextAreaElement
    expect(textarea.value).toBe('Remember to sync with design.')
  })

  it('calls save on blur when notes value has changed', () => {
    renderPanel({ notes: null })
    const textarea = screen.getByPlaceholderText('Add notes…')
    fireEvent.change(textarea, { target: { value: 'New note text.' } })
    fireEvent.blur(textarea)
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: expect.objectContaining({ notes: 'New note text.' }),
      }),
    )
  })

  it('does not call save on blur when notes value is unchanged', () => {
    renderPanel({ notes: 'Unchanged.' })
    const textarea = screen.getByPlaceholderText('Add notes…')
    fireEvent.blur(textarea)
    expect(mockMutate).not.toHaveBeenCalled()
  })
})
