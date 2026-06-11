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
    // The share modals are this query's only consumers and mount on demand —
    // override the app-wide 30s staleTime so the view telemetry they render
    // (viewCount / lastViewedAt) is current every time a modal opens.
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

interface CreateShareInput {
  /** "view" (default) or "ics" — ICS shares are live calendar feeds. */
  kind?: 'view' | 'ics'
  /** ICS shares only: "timeline" (every activity) or "member" (one member's). */
  scope?: 'timeline' | 'member'
  /** ICS shares with scope "member" only. */
  memberId?: string
  name?: string | null
  description?: string | null
  viewType?: string
  viewConfig?: string
  /** When set, the share is locked and requires unlocking to view. View shares only. */
  password?: string
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

/**
 * Rotates a share's token, immediately invalidating the old URL — the
 * revocation story for ICS feeds, which have no password gate.
 */
export function useRegenerateShare(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      authFetch<Share>(`/shares/${shareId}/regenerate`, { method: 'POST' }),
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

// ── Public hooks (no auth) ────────────────────────────────────────────────────

/**
 * Fetches a public share projection. No authentication required.
 *
 * For password-protected shares, pass the `viewToken` obtained from
 * {@link useUnlockShare}; it is sent as a Bearer credential. Without a valid
 * token a locked share responds 401 — surfaced here as an ApiError with code
 * `PASSWORD_REQUIRED` so the viewer can render an unlock prompt.
 */
export function useShareProjection(token: string | undefined, viewToken?: string | null) {
  return useQuery({
    queryKey: ['shares', token, viewToken ?? null] as const,
    queryFn: async () => {
      const headers: HeadersInit = viewToken ? { Authorization: `Bearer ${viewToken}` } : {}
      const res = await fetch(`${API_BASE}/shares/${token}`, { headers })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        // A locked share returns { passwordRequired: true } (no error envelope).
        if (res.status === 401 && body?.passwordRequired) {
          throw new ApiError(401, 'PASSWORD_REQUIRED', 'password required')
        }
        throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? res.statusText)
      }
      return res.json() as Promise<ShareProjection>
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Exchanges a share password for a short-lived view token. No authentication
 * required. The returned token is scoped to this share and expires server-side.
 */
export function useUnlockShare(token: string | undefined) {
  return useMutation({
    mutationFn: async (password: string): Promise<string> => {
      const res = await fetch(`${API_BASE}/shares/${token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? res.statusText)
      }
      return (body as { token: string }).token
    },
  })
}
