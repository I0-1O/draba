/**
 * useExport — tests for state management (isPending, error) and viewConfig
 * construction (activityIds takes precedence over filter; columns appended
 * independently). The blob-save path (URL.createObjectURL + anchor click) is
 * stubbed so tests run in jsdom without a real blob URL implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useExport } from './useExport'

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuthFetchBlob = vi.fn()
vi.mock('@/lib/api', () => ({
  createAuthFetchBlob: () => mockAuthFetchBlob,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: () => 'test-token' }),
}))

// ── Browser API stubs ─────────────────────────────────────────────────────────

// jsdom does not implement URL.createObjectURL; stub directly so saveBlob
// doesn't throw. Assigned (not spied) so restoreAllMocks cannot unset them.
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

// ── Helpers ───────────────────────────────────────────────────────────────────

const OK_RESPONSE = {
  blob: new Blob(['Title,Start\nAlpha,2026-05-01'], { type: 'text/csv' }),
  filename: 'export.csv',
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-stub after clearAllMocks wipes the return value.
  ;(URL.createObjectURL as ReturnType<typeof vi.fn>).mockReturnValue('blob:mock-url')
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useExport', () => {
  it('calls authFetchBlob with the correct endpoint and format', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => { await result.current.download('csv', '.csv') })

    expect(mockAuthFetchBlob).toHaveBeenCalledWith(
      '/timelines/tl-1/export',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((mockAuthFetchBlob.mock.calls[0][1] as RequestInit).body as string)
    expect(body.format).toBe('csv')
  })

  it('isPending is false after a successful download', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => { await result.current.download('csv', '.csv') })

    expect(result.current.isPending).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('sets error and rethrows when the request fails', async () => {
    const err = new Error('network error')
    mockAuthFetchBlob.mockRejectedValueOnce(err)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))

    await act(async () => {
      await result.current.download('csv', '.csv').catch(() => {})
    })

    await waitFor(() => expect(result.current.error).toBe(err))
    expect(result.current.isPending).toBe(false)
  })

  it('sends activityIds and omits filter when activityIds is non-empty', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => {
      await result.current.download('csv', '.csv', { activityIds: ['a1', 'a2'] })
    })

    const body = JSON.parse((mockAuthFetchBlob.mock.calls[0][1] as RequestInit).body as string)
    expect(body.viewConfig.activityIds).toEqual(['a1', 'a2'])
    expect(body.viewConfig.filter).toBeUndefined()
  })

  it('sends filter when activityIds is absent', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const filter = { logic: 'and' as const, conditions: [] }
    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => {
      await result.current.download('csv', '.csv', { filter })
    })

    const body = JSON.parse((mockAuthFetchBlob.mock.calls[0][1] as RequestInit).body as string)
    expect(body.viewConfig.filter).toEqual(filter)
    expect(body.viewConfig.activityIds).toBeUndefined()
  })

  it('includes columns in viewConfig alongside activityIds when both are provided', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => {
      await result.current.download('csv', '.csv', {
        activityIds: ['a1'],
        columns: ['Title', 'Start'],
      })
    })

    const body = JSON.parse((mockAuthFetchBlob.mock.calls[0][1] as RequestInit).body as string)
    expect(body.viewConfig.activityIds).toEqual(['a1'])
    expect(body.viewConfig.columns).toEqual(['Title', 'Start'])
  })

  it('omits viewConfig entirely when nothing is provided', async () => {
    mockAuthFetchBlob.mockResolvedValueOnce(OK_RESPONSE)

    const { result } = renderHook(() => useExport('tl-1', 'My Timeline'))
    await act(async () => { await result.current.download('csv', '.csv') })

    const body = JSON.parse((mockAuthFetchBlob.mock.calls[0][1] as RequestInit).body as string)
    expect(body.viewConfig).toBeUndefined()
  })
})
