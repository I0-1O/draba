/**
 * ImportWizard — behavior tests for the stepped flow: auto-mapped files skip
 * the mapping step, unmapped columns force it, mapping/date-order/tag-option
 * changes each re-run the dry-run, the commit button counts only importable
 * (ok + warning) rows, and the commit pass posts dryRun:false.
 *
 * The api module is mocked at the createAuthFetch seam so the real
 * useImportPreview/useCommitImport hooks (FormData construction, dryRun
 * toggling, query invalidation) are exercised, not stubbed.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

function csvFile(): File {
  return new File(['Title,Start\nAlpha,2026-03-05'], 'plan.csv', { type: 'text/csv' })
}

/** Reads the JSON options part out of the FormData body of the nth fetch call. */
function optionsOfCall(n: number): Record<string, unknown> {
  const init = mockAuthFetch.mock.calls[n][1] as RequestInit
  const fd = init.body as FormData
  return JSON.parse(fd.get('options') as string) as Record<string, unknown>
}

function renderWizard() {
  const onClose = vi.fn()
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <ImportWizard teamId="team-1" timelines={timelines} activeTimelineId="tl-1" onClose={onClose} />
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
