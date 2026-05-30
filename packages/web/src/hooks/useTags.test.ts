/**
 * useTags hooks — unit tests verifying query keys, mutation endpoints, and
 * cache invalidation. Uses a real QueryClient with fetch mocked globally.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from './useTags'

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

const TAG_FIXTURE = {
  id: 'tag-1',
  teamId: 'team-1',
  name: 'urgent',
  color: 'red',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00Z',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTags', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches tags from the correct URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([TAG_FIXTURE]), { status: 200 }),
    )

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useTags('team-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/teams/team-1/tags'),
      expect.any(Object),
    )
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('urgent')
  })

  it('does not fetch when teamId is empty', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useTags(''), { wrapper })
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})

describe('useCreateTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('POSTs to the correct URL and invalidates the tag list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(TAG_FIXTURE), { status: 201 }),
    )

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTag('team-1'), { wrapper })
    result.current.mutate({ name: 'urgent', color: 'red' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/teams/team-1/tags'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['teams', 'team-1', 'tags'] }),
    )
  })
})

describe('useUpdateTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('PATCHes the correct tag URL and invalidates the list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...TAG_FIXTURE, name: 'critical' }), { status: 200 }),
    )

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTag('team-1'), { wrapper })
    result.current.mutate({ id: 'tag-1', name: 'critical' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/tags/tag-1'),
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['teams', 'team-1', 'tags'] }),
    )
  })
})

describe('useDeleteTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('DELETEs the correct URL and invalidates the list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    const { wrapper, qc } = makeWrapper()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTag('team-1'), { wrapper })
    result.current.mutate('tag-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/tags/tag-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['teams', 'team-1', 'tags'] }),
    )
  })
})
