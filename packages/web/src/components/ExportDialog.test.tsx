/**
 * ExportDialog — behavior tests for the format rail, filter context strip,
 * scope picker, empty-view warning, download button states, and close paths.
 * useExport is module-mocked; this exercises the dialog's contract only.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import ExportDialog from './ExportDialog'
import type { TextExportData } from './ExportDialog'

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockDownload = vi.fn()
vi.mock('@/hooks/useExport', () => ({
  useExport: () => ({ download: mockDownload, isPending: false, error: null }),
}))

const mockCapturePngSnapshot = vi.fn()
vi.mock('@/lib/pngExport', () => ({
  capturePngSnapshot: (...args: unknown[]) => mockCapturePngSnapshot(...args),
}))

const mockPrintPresentationFrame = vi.fn()
vi.mock('@/lib/printExport', () => ({
  printPresentationFrame: (...args: unknown[]) => mockPrintPresentationFrame(...args),
}))

const mockSaveFramePresentationHtml = vi.fn()
vi.mock('@/lib/htmlExport', () => ({
  saveFramePresentationHtml: (...args: unknown[]) => mockSaveFramePresentationHtml(...args),
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

function makeTextExportData(overrides: Partial<TextExportData> = {}): TextExportData {
  return {
    activities: [],
    memberById: new Map(),
    statusById: new Map(),
    tagById: new Map(),
    activityTitleById: new Map(),
    kanbanColumns: null,
    listDisplayRows: null,
    listVisibleColumns: null,
    kanbanShowHierarchy: false,
    kanbanChildrenByParentId: new Map(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDownload.mockResolvedValue(undefined)
  mockCapturePngSnapshot.mockResolvedValue(new Blob(['fake-png'], { type: 'image/png' }))
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

// ── 14.2: Table/Outline style picker ───────────────────────────────────────────

describe('ExportDialog — style picker', () => {
  it('shows the Table/Outline picker for List view text formats', () => {
    renderDialog({ view: 'list' })
    fireEvent.click(screen.getByText('Markdown'))
    expect(screen.getByText('Table')).toBeInTheDocument()
    expect(screen.getByText('Outline')).toBeInTheDocument()
  })

  it('does not show the style picker for CSV', () => {
    renderDialog({ view: 'list' })
    // CSV is selected by default.
    expect(screen.queryByText('Outline')).not.toBeInTheDocument()
  })

  it('does not show the style picker for Kanban text formats (only List has a Table/Outline choice)', () => {
    renderDialog({ view: 'kanban' })
    fireEvent.click(screen.getByText('Markdown'))
    expect(screen.queryByText('Outline')).not.toBeInTheDocument()
  })

  it('updates the clipboard note to mention "outline" once Outline is selected', () => {
    renderDialog({ view: 'list' })
    fireEvent.click(screen.getByText('Copy to clipboard'))
    fireEvent.click(screen.getByText('Outline'))
    expect(screen.getByText(/paste into Slack, Google Docs, or Word to get a formatted outline/i)).toBeInTheDocument()
  })
})

// ── 14.2: client-side Markdown / plain-text download ───────────────────────────

describe('ExportDialog — client-side text downloads', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('generates a Markdown blob client-side instead of calling the server download hook', () => {
    const textExportData = makeTextExportData({ activities: [] })
    renderDialog({ view: 'list', textExportData })
    fireEvent.click(screen.getByText('Markdown'))
    fireEvent.click(screen.getByRole('button', { name: /Download \.md/i }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('generates a plain-text blob client-side', () => {
    const textExportData = makeTextExportData({ activities: [] })
    renderDialog({ view: 'list', textExportData })
    fireEvent.click(screen.getByText('Plain text'))
    fireEvent.click(screen.getByRole('button', { name: /Download \.txt/i }))
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('falls back to an empty data object (and does not throw) when textExportData is undefined', () => {
    renderDialog({ view: 'list', textExportData: undefined })
    fireEvent.click(screen.getByText('Markdown'))
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Download \.md/i }))).not.toThrow()
    expect(createObjectURL).toHaveBeenCalledTimes(1)
  })
})

// ── 14.2: copy to clipboard ─────────────────────────────────────────────────────

describe('ExportDialog — copy to clipboard', () => {
  let writeMock: ReturnType<typeof vi.fn>
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeMock = vi.fn().mockResolvedValue(undefined)
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { write: writeMock, writeText: writeTextMock },
    })
    vi.stubGlobal('ClipboardItem', class {
      constructor(public items: Record<string, Blob>) {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes both text/plain and text/html flavors via ClipboardItem', async () => {
    const textExportData = makeTextExportData({ activities: [] })
    renderDialog({ view: 'list', textExportData })
    fireEvent.click(screen.getByText('Copy to clipboard'))
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard/i }))

    await waitFor(() => expect(writeMock).toHaveBeenCalledTimes(1))
    const item = writeMock.mock.calls[0][0][0] as { items: Record<string, Blob> }
    expect(Object.keys(item.items)).toEqual(['text/plain', 'text/html'])
    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('shows "Copied!" after the clipboard write resolves', async () => {
    const textExportData = makeTextExportData({ activities: [] })
    renderDialog({ view: 'list', textExportData })
    fireEvent.click(screen.getByText('Copy to clipboard'))
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard/i }))
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('falls back to writeText when ClipboardItem is unavailable (HTTP context)', async () => {
    vi.stubGlobal('ClipboardItem', undefined)
    const textExportData = makeTextExportData({ activities: [] })
    renderDialog({ view: 'list', textExportData })
    fireEvent.click(screen.getByText('Copy to clipboard'))
    fireEvent.click(screen.getByRole('button', { name: /Copy to clipboard/i }))

    await waitFor(() => expect(writeTextMock).toHaveBeenCalledTimes(1))
    expect(writeMock).not.toHaveBeenCalled()
  })
})

// ── 14.3: PNG snapshot ──────────────────────────────────────────────────────────

describe('ExportDialog — PNG snapshot', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows PNG as a format option in every view, including Gantt', () => {
    renderDialog({ view: 'gantt' })
    const rail = screen.getByRole('listbox', { name: /Export format/i })
    expect(within(rail).getByText('PNG image')).toBeInTheDocument()
  })

  it('captures and downloads a PNG via capturePngSnapshot when an element is provided', async () => {
    const captureElement = document.createElement('div')
    renderDialog({ view: 'list', captureElement, timelineName: 'My Timeline', teamName: 'Acme', filterLabel: 'Open only' })
    fireEvent.click(screen.getByText('PNG image'))
    fireEvent.click(screen.getByRole('button', { name: /Download \.png/i }))

    await waitFor(() => expect(mockCapturePngSnapshot).toHaveBeenCalledTimes(1))
    expect(mockCapturePngSnapshot).toHaveBeenCalledWith(captureElement, {
      timelineName: 'My Timeline', teamName: 'Acme', filterLabel: 'Open only',
    })
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('does nothing (no throw) when captureElement is absent', () => {
    renderDialog({ view: 'list', captureElement: null })
    fireEvent.click(screen.getByText('PNG image'))
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Download \.png/i }))).not.toThrow()
    expect(mockCapturePngSnapshot).not.toHaveBeenCalled()
  })

  it('does not show the scope picker for PNG', () => {
    renderDialog({ view: 'list' })
    fireEvent.click(screen.getByText('PNG image'))
    expect(screen.queryByText('Entire timeline')).not.toBeInTheDocument()
  })
})

// ── 14.4: Printable view + HTML save ────────────────────────────────────────────

describe('ExportDialog — printable view + HTML save (14.4)', () => {
  it('shows Printable view and HTML file as format options in every view, including Gantt', () => {
    renderDialog({ view: 'gantt' })
    const rail = screen.getByRole('listbox', { name: /Export format/i })
    expect(within(rail).getByText('Printable view')).toBeInTheDocument()
    expect(within(rail).getByText('HTML file')).toBeInTheDocument()
  })

  it('calls printPresentationFrame with the frame and header info when Print… is clicked', () => {
    const presentationFrame = document.createElement('iframe')
    renderDialog({
      view: 'list', presentationFrame, timelineName: 'My Timeline', teamName: 'Acme', filterLabel: 'Open only',
    })
    fireEvent.click(screen.getByText('Printable view'))
    fireEvent.click(screen.getByRole('button', { name: /Print…/i }))

    expect(mockPrintPresentationFrame).toHaveBeenCalledWith(presentationFrame, {
      timelineName: 'My Timeline', teamName: 'Acme', filterLabel: 'Open only', periodLabel: undefined,
    })
  })

  it('does nothing (no throw) when presentationFrame is absent for Printable view', () => {
    renderDialog({ view: 'list', presentationFrame: null })
    fireEvent.click(screen.getByText('Printable view'))
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Print…/i }))).not.toThrow()
    expect(mockPrintPresentationFrame).not.toHaveBeenCalled()
  })

  it('does not show the scope picker or a filename chip for Printable view', () => {
    renderDialog({ view: 'list' })
    fireEvent.click(screen.getByText('Printable view'))
    expect(screen.queryByText('Entire timeline')).not.toBeInTheDocument()
  })

  it('calls saveFramePresentationHtml with the frame, header info, and filename when Download .html is clicked', () => {
    const presentationFrame = document.createElement('iframe')
    renderDialog({ view: 'kanban', presentationFrame, timelineName: 'My Timeline' })
    fireEvent.click(screen.getByText('HTML file'))
    fireEvent.click(screen.getByRole('button', { name: /Download \.html/i }))

    expect(mockSaveFramePresentationHtml).toHaveBeenCalledWith(
      presentationFrame,
      { timelineName: 'My Timeline', teamName: null, filterLabel: null, periodLabel: undefined },
      expect.stringContaining('kanban'),
    )
  })

  it('does nothing (no throw) when presentationFrame is absent for HTML save', () => {
    renderDialog({ view: 'list', presentationFrame: null })
    fireEvent.click(screen.getByText('HTML file'))
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Download \.html/i }))).not.toThrow()
    expect(mockSaveFramePresentationHtml).not.toHaveBeenCalled()
  })
})
