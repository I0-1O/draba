/**
 * TanStack Query hooks for Share CRUD and the public share projection.
 *
 * Authenticated hooks (useCreateShare, useListShares, useDeleteShare) require
 * an auth token. useShareProjection is public and uses a plain fetch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch, API_BASE, ApiError } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type Share = components['schemas']['Share']
type ShareProjection = components['schemas']['ShareProjection']

const sharesKey = (teamId: string, timelineId: string) =>
  ['teams', teamId, 'timelines', timelineId, 'shares'] as const

// ── Authenticated hooks ───────────────────────────────────────────────────────

/** Lists all shares for a timeline. */
export function useListShares(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: sharesKey(teamId, timelineId),
    queryFn: () =>
      authFetch<Share[]>(`/teams/${teamId}/timelines/${timelineId}/shares`),
    enabled: Boolean(teamId) && Boolean(timelineId),
  })
}

interface CreateShareInput {
  name?: string | null
  viewType: string
  viewConfig: string
}

/** Creates a share and invalidates the list. */
export function useCreateShare(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateShareInput) =>
      authFetch<Share>(`/timelines/${timelineId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sharesKey(teamId, timelineId) }),
  })
}

/** Deletes a share and invalidates the list. */
export function useDeleteShare(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      authFetch<void>(`/shares/${shareId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sharesKey(teamId, timelineId) }),
  })
}

// ── Public hook (no auth) ─────────────────────────────────────────────────────

/** Fetches a public share projection. No authentication required. */
export function useShareProjection(token: string | undefined) {
  return useQuery({
    queryKey: ['shares', token] as const,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/shares/${token}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? res.statusText)
      }
      return res.json() as Promise<ShareProjection>
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })
}
