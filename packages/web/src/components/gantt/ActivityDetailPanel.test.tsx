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
  useArchiveActivity: () => ({ mutate: vi.fn(), isPending: false }),
  useTimelineActivities: () => ({ data: [] }),
}))

vi.mock('@/hooks/useStatusTemplates', () => ({
  useTimelineStatuses: () => ({ data: [] }),
}))

const TAG_FIXTURE = {
  id: 'tag-a',
  teamId: 'team-1',
  name: 'urgent',
  color: 'red',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
}

vi.mock('@/hooks/useTags', () => ({
  useTags: () => ({ data: [TAG_FIXTURE] }),
  useCreateTag: () => ({ mutate: vi.fn() }),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseActivity = {
  id: 'act-1',
  title: 'Test Activity',
  startAt: '2026-06-01T00:00:00Z',
  endAt: '2026-06-05T00:00:00Z',
  timelineId: 'tl-1',
  allDay: false,
  statusId: null as string | null | undefined,
  description: null as string | null | undefined,
  notes: null as string | null | undefined,
  color: null as string | null | undefined,
  icon: null as string | null | undefined,
  location: null as string | null | undefined,
  url: null as string | null | undefined,
  parentActivityId: null as string | null | undefined,
  archivedAt: null as string | null | undefined,
  createdBy: 'user-1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  assignedMemberIds: [] as string[],
  tagIds: [] as string[],
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

describe('ActivityDetailPanel — tags field', () => {
  beforeEach(() => mockMutate.mockClear())

  it('renders the tag input with "Add tags…" placeholder when no tags are selected', () => {
    renderPanel({ tagIds: [] })
    expect(screen.getByPlaceholderText('Add tags…')).toBeTruthy()
  })

  it('renders selected tag pill when activity has a tagId matching the team tag', () => {
    renderPanel({ tagIds: ['tag-a'] })
    expect(screen.getByText('urgent')).toBeTruthy()
  })
})
