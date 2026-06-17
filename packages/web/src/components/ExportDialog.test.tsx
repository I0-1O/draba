/**
 * ExportDialog — behavior tests for the format rail, filter context strip,
 * scope picker, empty-view warning, download button states, and close paths.
 * useExport is module-mocked; this exercises the dialog's contract only.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ExportDialog from './ExportDialog'

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockDownload = vi.fn()
vi.mock('@/hooks/useExport', () => ({
  useExport: () => ({ download: mockDownload, isPending: false, error: null }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

type Props = Parameters<typeof ExportDialog>[0]

function renderDialog(overrides: Partial<Props> = {}) {
  const onClose = vi.fn()
  const props: Props = {
    view: 'list',
    teamId: 'team-1',
    timelineId: 'tl-1',
    timelineName: 'My Timeline',
    filterLabel: null,
    filterDefinition: null,
    filteredCount: 10,
    totalCount: 10,
    viewActivityIds: null,
    listExportColumns: null,
    onClose,
    ...overrides,
  }
  render(<ExportDialog {...props} />)
  return { onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDownload.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ExportDialog', () => {
  it('renders the dialog header and all three format options', () => {
    renderDialog()

    expect(screen.getByText('Export this view')).toBeInTheDocument()
    // Format rail is a listbox; each option has role="option".
    const rail = screen.getByRole('listbox', { name: /Export format/i })
    expect(within(rail).getByText('CSV')).toBeInTheDocument()
    expect(within(rail).getByText('Excel')).toBeInTheDocument()
    expect(within(rail).getByText('Calendar (.ics)')).toBeInTheDocument()
  })

  it('shows "Exporting the List view as you see it" when no filter is active', () => {
    renderDialog({ view: 'list', filterLabel: null })
    expect(screen.getByText(/Exporting the List view as you see it/i)).toBeInTheDocument()
  })

  it('shows the filter label and counts when a filter is active', () => {
    renderDialog({ filterLabel: 'Open only', filteredCount: 3, totalCount: 10 })
    expect(screen.getByText('Open only')).toBeInTheDocument()
    // The filter strip shows the count as an exact short string; the scope
    // picker sub-row has the longer "· matches your filter" suffix.
    expect(screen.getByText('3 of 10 activities')).toBeInTheDocument()
  })

  it('shows an empty-view warning when filteredCount is 0', () => {
    renderDialog({ filteredCount: 0, filterLabel: 'Open only', totalCount: 5 })
    expect(screen.getByText(/no activities/i)).toBeInTheDocument()
  })

  it('switching to Excel updates the options pane heading', () => {
    renderDialog()
    const rail = screen.getByRole('listbox', { name: /Export format/i })
    fireEvent.click(within(rail).getByText('Excel'))
    // The options pane heading (outside the rail) should now say "Excel".
    const heading = screen.getAllByText('Excel').find(el => !rail.contains(el))
    expect(heading).toBeDefined()
  })

  it('calls download with csv format when Download is clicked', () => {
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /Download/i }))
    expect(mockDownload).toHaveBeenCalledWith('csv', '.csv', expect.any(Object))
  })

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed', () => {
    const { onClose } = renderDialog()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('does NOT call onClose when the overlay backdrop is clicked', () => {
    // Per the design handoff: only Esc / Cancel / X close the dialog — overlay click does not.
    const { onClose } = renderDialog()
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) fireEvent.click(overlay)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('passes viewActivityIds to download when scope is "view" and ids are present', () => {
    renderDialog({ viewActivityIds: ['a1', 'a2'] })
    fireEvent.click(screen.getByRole('button', { name: /Download/i }))
    const config = mockDownload.mock.calls[0][2] as { activityIds: string[] }
    expect(config.activityIds).toEqual(['a1', 'a2'])
  })

  it('passes null activityIds when scope is switched to "Entire timeline"', () => {
    renderDialog({ viewActivityIds: ['a1', 'a2'] })
    fireEvent.click(screen.getByText('Entire timeline'))
    fireEvent.click(screen.getByRole('button', { name: /Download/i }))
    const config = mockDownload.mock.calls[0][2] as { activityIds: null }
    expect(config.activityIds).toBeNull()
  })
})
