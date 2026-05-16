/**
 * TanStack Query hooks for team-scoped data.
 *
 * All hooks call createAuthFetch to inject the current access token at
 * query-time so stale closures never send an expired token.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type Event = components['schemas']['Event']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

/** Query key factory — centralises cache key strings. */
export const keys = {
  teamEvents: (teamId: string, from?: string, to?: string) =>
    ['teams', teamId, 'events', { from, to }] as const,
  teamMembers: (teamId: string) =>
    ['teams', teamId, 'members'] as const,
}

/** Fetches all events for a team, optionally filtered by date range. */
export function useTeamEvents(teamId: string, from?: string, to?: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.teamEvents(teamId, from, to),
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      return authFetch<Event[]>(`/teams/${teamId}/events${qs ? `?${qs}` : ''}`)
    },
    enabled: Boolean(teamId),
  })
}

/** Fetches the member list for a team. */
export function useTeamMembers(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.teamMembers(teamId),
    queryFn: () => authFetch<TeamMemberWithUser[]>(`/teams/${teamId}/members`),
    enabled: Boolean(teamId),
  })
}

/**
 * Returns a function that invalidates the events cache for a team.
 * Used by the WebSocket handler to trigger a refetch after a delta arrives.
 */
export function useInvalidateTeamEvents(teamId: string) {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: ['teams', teamId, 'events'] })
}
