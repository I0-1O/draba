/**
 * ImportWizard — behavior tests for the stepped flow: auto-mapped files skip
 * the mapping step, unmapped columns force it, mapping/date-order/tag-option
 * changes each re-run the dry-run, the commit button counts only importable
 * (ok + warning) rows, the commit pass posts dryRun:false, and a failed
 * commit stays on the preview step with an error banner.
 *
 * The api module is mocked at the createAuthFetch seam so the real
 * useImportPreview/useCommitImport hooks (FormData construction, dryRun
 * toggling, query invalidation) are exercised, not stubbed.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ImportWizard from './ImportWizard'
import type { ImportResult } from '@/hooks/useImport'
import type { components } from '@draba/shared'

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuthFetch = vi.fn()
const mockAuthFetchBlob = vi.fn()
vi.mock('@/lib/api', () => ({
  createAuthFetch: () => mockAuthFetch,
  createAuthFetchBlob: () => mockAuthFetchBlob,
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: () => 'test-token' }),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

// reason: test fixture — the wizard only reads id and name from Timeline.
const timelines = [
  { id: 'tl-1', name: 'Q3 Plan' },
  { id: 'tl-2', name: 'Q4 Plan' },
] as components['schemas']['Timeline'][]

const baseSummary = { total: 3, ok: 1, warnings: 1, errors: 1, created: 0 }
const noUnknowns = { statuses: [], assignees: [], tags: [] }

/** A fully auto-mapped dry-run result: 1 ok, 1 warning, 1 error row. */
function autoMappedResult(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    mapping: { Title: 'title', Start: 'start', End: 'end' },
    summary: baseSummary,
    unknownNames: noUnknowns,
    fileIssues: [],
    rows: [
      { line: 2, status: 'ok', activity: { title: 'Alpha', start: '2026-03-05', end: '2026-03-07' }, issues: [] },
      {
        line: 3,
        status: 'warning',
        activity: { title: 'Beta', start: '2026-03-08', end: '2026-03-08' },
        issues: [{ level: 'warning', field: 'end', message: 'missing End — set to Start' }],
      },
      {
        line: 4,
        status: 'error',
        activity: { title: 'Gamma' },
        issues: [{ level: 'error', field: 'start', message: '"soon" is not a recognizable date' }],
      },
    ],
    ...overrides,
  }
}

/** A result whose auto-mapping left a column unmapped → mapping step. */
function unmappedResult(): ImportResult {
  return autoMappedResult({
    mapping: { Task: 'title', Begin: 'start', Budget: '' },
    fileIssues: [{ level: 'warning', message: 'Column "Budget" not imported' }],
  })
}

/** A result whose numeric dates stayed ambiguous — the server disclosed the
 * order it applied with the exact per-cell warning text from importer/dates.go. */
function ambiguousDatesResult(): ImportResult {
  return autoMappedResult({
    mapping: { Task: 'title', Begin: 'start', Budget: '' },
    rows: [
      {
        line: 2,
        status: 'warning',
        activity: { title: 'Alpha', start: '2026-03-05', end: '2026-03-05' },
        issues: [{ level: 'warning', field: 'start', message: '"3/5/26" read as month-day-year' }],
      },
    ],
  })
}

function csvFile(): File {
  return new File(['Title,Start\nAlpha,2026-03-05'], 'plan.csv', { type: 'text/csv' })
}

/** Reads the JSON options part out of the FormData body of the nth fetch call. */
function optionsOfCall(n: number): Record<string, unknown> {
  const init = mockAuthFetch.mock.calls[n][1] as RequestInit
  const fd = init.body as FormData
  return JSON.parse(fd.get('options') as string) as Record<string, unknown>
}

function renderWizard(props: { onGoToTimeline?: (id: string) => void } = {}) {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ImportWizard teamId="team-1" timelines={timelines} activeTimelineId="tl-1" onClose={onClose} {...props} />
    </QueryClientProvider>,
  )
  return { onClose }
}

async function chooseFile() {
  fireEvent.change(screen.getByLabelText('Import file'), { target: { files: [csvFile()] } })
  await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled())
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ImportWizard', () => {
  it('skips the mapping step when auto-mapping is complete and shows the preview', async () => {
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()

    expect(await screen.findByText('1 ready')).toBeInTheDocument()
    expect(screen.getByText(/Preview import/)).toBeInTheDocument()
    // The first pass is a dry-run against the pre-selected timeline.
    expect(mockAuthFetch).toHaveBeenCalledWith('/teams/team-1/timelines/tl-1/import', expect.objectContaining({ method: 'POST' }))
    expect(optionsOfCall(0).dryRun).toBe(true)
  })

  it('shows the mapping step when auto-mapping left columns unmapped', async () => {
    mockAuthFetch.mockResolvedValueOnce(unmappedResult())
    renderWizard()
    await chooseFile()

    expect(await screen.findByText(/Map columns/)).toBeInTheDocument()
    // The unmapped column renders with "Don't import" selected.
    expect(screen.getByLabelText('Field for column Budget')).toHaveValue('')
    // No ambiguous-date warnings in this result → no date-order question.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('sorts unmapped columns first and disables fields already claimed by another column', async () => {
    mockAuthFetch.mockResolvedValueOnce(unmappedResult())
    renderWizard()
    await chooseFile()
    await screen.findByText(/Map columns/)

    // Unmapped Budget outranks the alphabetically-earlier mapped columns.
    const selects = screen.getAllByLabelText(/^Field for column /)
    expect(selects.map(s => s.getAttribute('aria-label'))).toEqual([
      'Field for column Budget',
      'Field for column Begin',
      'Field for column Task',
    ])

    // In Budget's dropdown: Title is claimed by Task → disabled; Description is free.
    const budget = screen.getByLabelText('Field for column Budget')
    expect(within(budget).getByRole('option', { name: 'Title' })).toBeDisabled()
    expect(within(budget).getByRole('option', { name: 'Description' })).toBeEnabled()
    // A column's own field stays selectable in its own dropdown.
    const task = screen.getByLabelText('Field for column Task')
    expect(within(task).getByRole('option', { name: 'Title' })).toBeEnabled()
  })

  it('shows the date-order question for ambiguous dates and re-runs the dry-run on change', async () => {
    mockAuthFetch.mockResolvedValue(ambiguousDatesResult())
    renderWizard()
    await chooseFile()
    await screen.findByText(/Map columns/)

    // The server's "read as month-day-year" warning is the only trigger.
    expect(screen.getByRole('radio', { name: /Month \/ Day \/ Year/ })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: /Day \/ Month \/ Year/ }))

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
    expect(optionsOfCall(1)).toMatchObject({ dryRun: true, dateOrder: 'dmy' })
  })

  it('re-runs the dry-run with the explicit mapping when a column is reassigned', async () => {
    mockAuthFetch.mockResolvedValue(unmappedResult())
    renderWizard()
    await chooseFile()
    await screen.findByText(/Map columns/)

    fireEvent.change(screen.getByLabelText('Field for column Budget'), { target: { value: 'description' } })

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
    const opts = optionsOfCall(1)
    expect(opts.dryRun).toBe(true)
    // Explicit mapping includes only mapped columns — ignored ones are omitted.
    expect(opts.mapping).toEqual({ Task: 'title', Begin: 'start', Budget: 'description' })
  })

  it('counts only ok + warning rows on the import button and excludes error rows', async () => {
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()

    // 1 ok + 1 warning = 2 importable; the error row is excluded.
    expect(await screen.findByRole('button', { name: 'Import 2 activities' })).toBeInTheDocument()
  })

  it('commits with dryRun:false and shows the result summary', async () => {
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()

    const commitResult = autoMappedResult({ summary: { ...baseSummary, created: 2 } })
    mockAuthFetch.mockResolvedValueOnce(commitResult)
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 activities' }))

    expect(await screen.findByText('2 activities imported')).toBeInTheDocument()
    expect(screen.getByText(/1 row skipped \(errors\)/)).toBeInTheDocument()
    expect(optionsOfCall(1).dryRun).toBe(false)
  })

  it('stays on the preview step with the server message when the commit fails', async () => {
    const { ApiError } = await import('@/lib/api')
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()

    mockAuthFetch.mockRejectedValueOnce(new ApiError(409, 'IMPORT_CONFLICT', 'timeline was archived mid-import'))
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 activities' }))

    expect(await screen.findByText('timeline was archived mid-import')).toBeInTheDocument()
    // No advance to the result step — the preview (and its data) stays put…
    expect(screen.getByText(/Preview import/)).toBeInTheDocument()
    expect(screen.getByText('1 ready')).toBeInTheDocument()
    // …and the commit button is re-enabled for a retry.
    expect(screen.getByRole('button', { name: 'Import 2 activities' })).toBeEnabled()
  })

  it('falls back to a generic message when the commit fails without an ApiError', async () => {
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()

    mockAuthFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 activities' }))

    expect(await screen.findByText('Import failed — nothing was written. Try again.')).toBeInTheDocument()
    expect(screen.getByText(/Preview import/)).toBeInTheDocument()
  })

  it('fetches and saves the template from the upload-step download links', async () => {
    // jsdom has no object-URL support — stub the pieces saveBlob touches.
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    mockAuthFetchBlob.mockResolvedValue({ blob: new Blob(['Title,Start']), filename: 'draba-import-template.csv' })

    renderWizard()
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1))
    expect(mockAuthFetchBlob).toHaveBeenCalledWith('/import/template.csv')
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')

    fireEvent.click(screen.getByRole('button', { name: 'Excel' }))
    await waitFor(() => expect(mockAuthFetchBlob).toHaveBeenCalledWith('/import/template.xlsx'))

    click.mockRestore()
  })

  it('offers "View timeline" after importing into a non-active timeline', async () => {
    const onGoToTimeline = vi.fn()
    mockAuthFetch.mockResolvedValue(autoMappedResult())
    const { onClose } = renderWizard({ onGoToTimeline })

    // Retarget the import at tl-2 (the active timeline is tl-1).
    fireEvent.change(screen.getByLabelText('Import into'), { target: { value: 'tl-2' } })
    await chooseFile()
    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 activities' }))

    fireEvent.click(await screen.findByRole('button', { name: 'View timeline' }))
    expect(onGoToTimeline).toHaveBeenCalledWith('tl-2')
    expect(onClose).toHaveBeenCalled()
  })

  it('hides "View timeline" when the import targeted the already-active timeline', async () => {
    mockAuthFetch.mockResolvedValue(autoMappedResult())
    renderWizard({ onGoToTimeline: vi.fn() })
    await chooseFile()

    fireEvent.click(await screen.findByRole('button', { name: 'Import 2 activities' }))
    await screen.findByRole('button', { name: 'Done' })
    expect(screen.queryByRole('button', { name: 'View timeline' })).not.toBeInTheDocument()
  })

  it('re-runs the dry-run with createMissingTags when the tag checkbox is toggled', async () => {
    const withTags = autoMappedResult({ unknownNames: { ...noUnknowns, tags: ['q3', 'launch'] } })
    mockAuthFetch.mockResolvedValue(withTags)
    renderWizard()
    await chooseFile()

    fireEvent.click(await screen.findByRole('checkbox'))

    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalledTimes(2))
    expect(optionsOfCall(1).createMissingTags).toBe(true)
  })

  it('filters the row table with the Warnings and Errors chips', async () => {
    mockAuthFetch.mockResolvedValueOnce(autoMappedResult())
    renderWizard()
    await chooseFile()
    await screen.findByText('1 ready')

    fireEvent.click(screen.getByRole('tab', { name: 'Errors (1)' }))
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Warnings (1)' }))
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Gamma')).not.toBeInTheDocument()
  })

  it('returns to the upload step with the server message on a file-level error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockAuthFetch.mockRejectedValueOnce(new ApiError(400, 'IMPORT_FILE_INVALID', 'no mappable Title column'))
    renderWizard()
    await chooseFile()

    expect(await screen.findByText('no mappable Title column')).toBeInTheDocument()
    expect(screen.getByText(/Upload a file/)).toBeInTheDocument()
  })
})
