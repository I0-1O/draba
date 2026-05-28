/**
 * TanStack Query hooks for user preferences. Preferences are user-private and
 * optionally scoped to a timeline. Global prefs (theme, selected team/timeline)
 * use no timeline scope; per-timeline prefs (group_by, sort_by, etc.) pass the
 * active timeline ID.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type UserPreference = components['schemas']['UserPreference']

const prefsKey = (timelineId?: string) =>
  ['users', 'me', 'preferences', timelineId ?? ''] as const

/** Returns all preferences for the given scope (global when timelineId is absent). */
export function usePreferences(timelineId?: string) {
  const { getAccessToken, accessToken, initializing } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qs = timelineId ? `?timeline_id=${encodeURIComponent(timelineId)}` : ''
  return useQuery({
    queryKey: prefsKey(timelineId),
    queryFn: () => authFetch<UserPreference[]>(`/users/me/preferences${qs}`),
    // Don't fire while the session is being restored or when logged out —
    // this hook is called from ThemeSync which mounts outside ProtectedRoute.
    enabled: !initializing && !!accessToken,
  })
}

interface UpsertInput {
  key: string
  value: string
  timelineId?: string
}

/** Creates or updates a single preference, then invalidates the relevant list. */
export function useUpsertPreference() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertInput) =>
      authFetch<UserPreference>('/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: (_, { timelineId }) => {
      qc.invalidateQueries({ queryKey: prefsKey(timelineId) })
    },
  })
}

/**
 * Convenience: return a typed map of key → value (parsed JSON) for the given
 * scope. Callers get a stable reference that re-renders only when the query
 * data changes, avoiding per-key re-renders.
 */
export function usePreferenceMap(timelineId?: string): Record<string, unknown> {
  const { data = [] } = usePreferences(timelineId)
  const map: Record<string, unknown> = {}
  for (const pref of data) {
    try {
      map[pref.key] = JSON.parse(pref.value)
    } catch {
      map[pref.key] = pref.value
    }
  }
  return map
}
