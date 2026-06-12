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
  useRegenerateShare,
  useShareProjection,
  useUnlockShare,
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

  it('refetches on every mount despite a non-zero app-wide staleTime', async () => {
    // Fresh Response per call — a Response body can only be consumed once.
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify([SHARE_FIXTURE]), { status: 200 })),
    )

    // Mirror the app QueryClient's 30s default staleTime: the hook must
    // override it (staleTime: 0 + refetchOnMount: 'always') so the view
    // telemetry it renders (viewCount / lastViewedAt) is current every time
    // a share modal opens.
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client: qc }, children)

    const first = renderHook(() => useListShares('team-1', 'tl-1'), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    first.unmount()

    renderHook(() => useListShares('team-1', 'tl-1'), { wrapper })
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
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

describe('useCreateShare (ICS feeds)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('sends kind/scope/memberId for a member-scoped ICS feed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...SHARE_FIXTURE, kind: 'ics', scope: 'member', memberId: 'm-1' }), { status: 201 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateShare('team-1', 'tl-1'), { wrapper })
    result.current.mutate({ kind: 'ics', scope: 'member', memberId: 'm-1', name: 'Feed' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const opts = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect(JSON.parse(String(opts.body))).toMatchObject({
      kind: 'ics',
      scope: 'member',
      memberId: 'm-1',
    })
  })
})

// ── useRegenerateShare ────────────────────────────────────────────────────────

describe('useRegenerateShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs to the regenerate endpoint and invalidates the share list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...SHARE_FIXTURE, token: 'rotated' }), { status: 200 }),
    )

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRegenerateShare('team-1', 'tl-1'), { wrapper })
    result.current.mutate('share-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/shares/share-1/regenerate'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.current.data?.token).toBe('rotated')
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
      expect.anything(),
    )
    // No Authorization header — this is a public endpoint (no view token passed).
    const callArgs = vi.mocked(fetch).mock.calls[0]
    const opts = callArgs[1] as RequestInit | undefined
    const headers = (opts?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
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

  it('sends the view token as a Bearer header when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(PROJECTION_FIXTURE), { status: 200 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShareProjection('abc123', 'view-jwt'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const opts = vi.mocked(fetch).mock.calls[0][1] as RequestInit | undefined
    const headers = (opts?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBe('Bearer view-jwt')
  })

  it('maps a 401 { passwordRequired } response to a PASSWORD_REQUIRED error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ passwordRequired: true }), { status: 401 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useShareProjection('locked-token'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const err = result.current.error as { status?: number; code?: string }
    expect(err.status).toBe(401)
    expect(err.code).toBe('PASSWORD_REQUIRED')
  })
})

// ── useUnlockShare ──────────────────────────────────────────────────────────────

describe('useUnlockShare', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs the password to the unlock endpoint and returns the view token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ token: 'view-jwt' }), { status: 200 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUnlockShare('abc123'), { wrapper })

    let token = ''
    await waitFor(async () => { token = await result.current.mutateAsync('hunter2') })

    expect(token).toBe('view-jwt')
    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/shares/abc123/unlock')
    expect(opts?.method).toBe('POST')
    expect(JSON.parse(String(opts?.body))).toEqual({ password: 'hunter2' })
  })

  it('throws an ApiError on a wrong password (401)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'INVALID_PASSWORD', message: 'incorrect password' } }), { status: 401 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUnlockShare('abc123'), { wrapper })

    await expect(result.current.mutateAsync('wrong')).rejects.toMatchObject({ status: 401 })
  })
})
