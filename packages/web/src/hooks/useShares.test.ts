/**
 * useShares hooks — unit tests verifying query keys, mutation endpoints,
 * cache invalidation, and the public share projection fetch.
 * Uses a real QueryClient with fetch mocked globally.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import {
  useListShares,
  useCreateShare,
  useDeleteShare,
  useShareProjection,
} from './useShares'

// ── Auth mock ─────────────────────────────────────────────────────────────────

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ getAccessToken: async () => 'test-token' }),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children),
  }
}

const SHARE_FIXTURE = {
  id: 'share-1',
  timelineId: 'tl-1',
  token: 'abc123',
  viewType: 'gantt',
  viewConfig: '{}',
  createdBy: 'member-1',
  createdAt: '2026-01-01T00:00:00Z',
  viewCount: 0,
}

// ── useListShares ─────────────────────────────────────────────────────────────

describe('useListShares', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches shares from the correct URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([SHARE_FIXTURE]), { status: 200 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useListShares('team-1', 'tl-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/teams/team-1/timelines/tl-1/shares'),
      expect.any(Object),
    )
    expect(result.current.data).toHaveLength(1)
  })

  it('does not fetch when teamId is empty', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useListShares('', 'tl-1'), { wrapper })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('does not fetch when timelineId is empty', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useListShares('team-1', ''), { wrapper })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})

// ── useCreateShare ────────────────────────────────────────────────────────────

describe('useCreateShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs to the correct URL and invalidates the share list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(SHARE_FIXTURE), { status: 201 }),
    )

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateShare('team-1', 'tl-1'), { wrapper })
    result.current.mutate({ viewType: 'gantt', viewConfig: '{}' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/timelines/tl-1/shares'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['teams', 'team-1', 'timelines', 'tl-1', 'shares'],
      }),
    )
  })
})

// ── useDeleteShare ────────────────────────────────────────────────────────────

describe('useDeleteShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('DELETEs the correct URL and invalidates the share list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteShare('team-1', 'tl-1'), { wrapper })
    result.current.mutate('share-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/shares/share-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['teams', 'team-1', 'timelines', 'tl-1', 'shares'],
      }),
    )
  })
})

// ── useShareProjection ────────────────────────────────────────────────────────

const PROJECTION_FIXTURE = {
  share: {
    id: 'share-1',
    timelineId: 'tl-1',
    token: 'abc123',
    viewType: 'gantt',
    viewConfig: '{}',
    createdAt: '2026-01-01T00:00:00Z',
  },
  teamName: 'Test Team',
  timeline: { id: 'tl-1', name: 'Q1 Plan', startDate: '2026-01-01', endDate: '2026-12-31' },
  members: [],
  statuses: [],
  tags: [],
  activities: [],
}

describe('useShareProjection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches the public projection without an auth header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(PROJECTION_FIXTURE), { status: 200 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShareProjection('abc123'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/shares/abc123'),
    )
    // No Authorization header — this is a public endpoint.
    const callArgs = vi.mocked(fetch).mock.calls[0]
    expect(callArgs).toHaveLength(1)
    expect(result.current.data?.teamName).toBe('Test Team')
  })

  it('does not fetch when token is undefined', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useShareProjection(undefined), { wrapper })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('throws an ApiError with the response status on non-200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'share not found' } }),
        { status: 404 },
      ),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShareProjection('bad-token'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const err = result.current.error as { status?: number; code?: string }
    expect(err.status).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })
})
