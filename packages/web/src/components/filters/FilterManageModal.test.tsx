/**
 * FilterManageModal.test.tsx — smoke tests for the filter management modal.
 *
 * All API hooks are mocked so the component renders without a live server.
 * Focus: modal open/close, tab rendering, filter list display, empty states.
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { components } from '@draba/shared'

// ── Mock all hook dependencies ────────────────────────────────────────────────

const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/hooks/useSavedFilters', () => ({
  useSavedFilters: vi.fn(() => ({ data: [] })),
  useAllTeamSavedFilters: vi.fn(() => ({ data: [] })),
  useCreateSavedFilter: vi.fn(() => mockCreate),
  useUpdateSavedFilter: vi.fn(() => mockUpdate),
  useDeleteSavedFilter: vi.fn(() => mockDelete),
}))

vi.mock('@/hooks/useTeamActivities', () => ({
  useTeamMembers: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/hooks/useStatusTemplates', () => ({
  useTimelineStatuses: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/hooks/useTags', () => ({
  useTags: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-alice', role: 'admin' } })),
}))

import FilterManageModal from './FilterManageModal'
import { useSavedFilters } from '@/hooks/useSavedFilters'

type SavedFilter = components['schemas']['SavedFilter']

function makeFilter(id: string, name: string, isTeam = false): SavedFilter {
  return {
    id,
    teamId: 'team-1',
    userId: 'user-alice',
    name,
    definition: '{"logic":"and","conditions":[]}',
    isTeamFilter: isTeam,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

const baseProps = {
  open: true,
  onClose: vi.fn(),
  teamId: 'team-1',
  timelineId: 'tl-1',
  isAdmin: true,
}

describe('FilterManageModal', () => {
  beforeEach(() => {
    vi.mocked(useSavedFilters).mockReturnValue({ data: [] } as ReturnType<typeof useSavedFilters>)
  })

  it('does not render when open=false', () => {
    render(<FilterManageModal {...baseProps} open={false} />)
    expect(screen.queryByText('Manage Filters')).not.toBeInTheDocument()
  })

  it('renders the modal heading when open=true', () => {
    render(<FilterManageModal {...baseProps} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('shows "My filters" and "Team filters" tabs', () => {
    render(<FilterManageModal {...baseProps} />)
    expect(screen.getByText('My filters')).toBeInTheDocument()
    expect(screen.getByText('Team filters')).toBeInTheDocument()
  })

  it('shows empty state when user has no filters', () => {
    render(<FilterManageModal {...baseProps} />)
    expect(screen.getByText('No filters yet')).toBeInTheDocument()
  })

  it('renders a filter row when the user has a filter', () => {
    vi.mocked(useSavedFilters).mockReturnValue({ data: [makeFilter('f-1', 'My sprint view')] } as ReturnType<typeof useSavedFilters>)
    render(<FilterManageModal {...baseProps} />)
    expect(screen.getByText('My sprint view')).toBeInTheDocument()
  })

  it('shows New Filter button that opens the editor', () => {
    render(<FilterManageModal {...baseProps} />)
    // The primary "New filter" button appears in the list header
    const newBtns = screen.getAllByText(/new filter/i)
    expect(newBtns.length).toBeGreaterThan(0)
    fireEvent.click(newBtns[0])
    // Editor panel should appear with a name input
    expect(screen.getByPlaceholderText('e.g. My open tasks')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<FilterManageModal {...baseProps} onClose={onClose} />)
    // The × header close button has title="Close"
    const closeBtn = screen.getByTitle('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it("shows Members' filters tab for admins", () => {
    render(<FilterManageModal {...baseProps} isAdmin={true} />)
    expect(screen.getByText("Members' filters")).toBeInTheDocument()
  })

  it("hides Members' filters tab for non-admins", () => {
    render(<FilterManageModal {...baseProps} isAdmin={false} />)
    expect(screen.queryByText("Members' filters")).not.toBeInTheDocument()
  })
})
