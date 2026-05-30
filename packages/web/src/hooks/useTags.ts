/**
 * TanStack Query hooks for Tag CRUD. Tags are team-scoped and can be applied
 * to activities across any timeline in the team.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export interface Tag {
  id: string
  teamId: string
  name: string
  color?: string | null
  createdBy: string
  createdAt: string
}

const tagsKey = (teamId: string) => ['teams', teamId, 'tags'] as const

/** Fetches all tags for a team, ordered by name. */
export function useTags(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: tagsKey(teamId),
    queryFn: () => authFetch<Tag[]>(`/teams/${teamId}/tags`),
    enabled: Boolean(teamId),
  })
}

interface CreateTagInput {
  name: string
  color?: string
}

/** Creates a new tag and invalidates the list. */
export function useCreateTag(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTagInput) =>
      authFetch<Tag>(`/teams/${teamId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagsKey(teamId) }),
  })
}

interface UpdateTagInput {
  id: string
  name?: string
  color?: string | null
}

/** Updates a tag's name or color and invalidates the list. */
export function useUpdateTag(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: UpdateTagInput) =>
      authFetch<Tag>(`/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagsKey(teamId) }),
  })
}

/** Deletes a tag (cascades activity_tags) and invalidates the list. */
export function useDeleteTag(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/tags/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: tagsKey(teamId) }),
  })
}
