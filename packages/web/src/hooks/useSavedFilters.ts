/**
 * TanStack Query hooks for SavedFilter CRUD. Filters are user-private and
 * team-scoped; mutations invalidate the list key for that team.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type SavedFilter = components['schemas']['SavedFilter']

const savedFiltersKey = (teamId: string) => ['teams', teamId, 'saved_filters'] as const

/** Fetches saved filters for the calling user within a team. */
export function useSavedFilters(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: savedFiltersKey(teamId),
    queryFn: () => authFetch<SavedFilter[]>(`/teams/${teamId}/saved_filters`),
    enabled: Boolean(teamId),
  })
}

interface CreateSavedFilterInput {
  name: string
  definition: string
}

/** Creates a new saved filter and invalidates the list. */
export function useCreateSavedFilter(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSavedFilterInput) =>
      authFetch<SavedFilter>(`/teams/${teamId}/saved_filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFiltersKey(teamId) }),
  })
}

interface UpdateSavedFilterInput {
  id: string
  name?: string
  definition?: string
}

/** Updates an existing saved filter (owner-only) and invalidates the list. */
export function useUpdateSavedFilter(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateSavedFilterInput) =>
      authFetch<SavedFilter>(`/saved_filters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFiltersKey(teamId) }),
  })
}

/** Deletes a saved filter (owner-only) and invalidates the list. */
export function useDeleteSavedFilter(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/saved_filters/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: savedFiltersKey(teamId) }),
  })
}
