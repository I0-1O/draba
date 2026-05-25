/**
 * TanStack Query hooks for team-scoped data.
 *
 * All hooks call createAuthFetch to inject the current access token at
 * query-time so stale closures never send an expired token.
 */

import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocket } from '@/hooks/useWebSocket'

type Activity = components['schemas']['Activity']
type Team = components['schemas']['Team']
type Timeline = components['schemas']['Timeline']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

/** Query key factory — centralises cache key strings. */
export const keys = {
  myTeams: () => ['teams'] as const,
  teamActivities: (teamId: string, from?: string, to?: string) =>
    ['teams', teamId, 'activities', { from, to }] as const,
  teamMembers: (teamId: string) =>
    ['teams', teamId, 'members'] as const,
  teamTimelines: (teamId: string) =>
    ['teams', teamId, 'timelines'] as const,
}

/** Fetches all teams the authenticated user belongs to. */
export function useMyTeams(includeArchived = false) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: [...keys.myTeams(), { includeArchived }],
    queryFn: () => authFetch<Team[]>(includeArchived ? '/teams?archived=true' : '/teams'),
  })
}

/** Fetches a single team by ID. */
export function useTeam(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: ['teams', teamId],
    queryFn: () => authFetch<Team>(`/teams/${teamId}`),
    enabled: Boolean(teamId),
  })
}

/** Fetches all non-archived timelines for a team. */
export function useTeamTimelines(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.teamTimelines(teamId),
    queryFn: () => authFetch<Timeline[]>(`/teams/${teamId}/timelines`),
    enabled: Boolean(teamId),
  })
}

/** Fetches all activities for a team, optionally filtered by date range. */
export function useTeamActivities(teamId: string, from?: string, to?: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.teamActivities(teamId, from, to),
    queryFn: () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      return authFetch<Activity[]>(`/teams/${teamId}/activities${qs ? `?${qs}` : ''}`)
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
 * Subscribes to the team's WebSocket feed and applies surgical cache updates
 * for activity.created / activity.updated / activity.deleted deltas.
 *
 * Conflict strategy: for activity.updated, incoming deltas are only applied
 * when their updatedAt timestamp is strictly newer than the cached version.
 * This prevents self-echo (our own PATCH broadcast arriving back) and handles
 * the last-writer-wins case where a concurrent remote edit arrives while our
 * mutation is in-flight — the server-returned updatedAt on our onSuccess will
 * always win if our PATCH was truly last.
 */
export function useTeamActivitySync(
  teamId: string,
  accessToken: string | null | undefined,
) {
  const client = useQueryClient()

  const handleMessage = useCallback(
    (msg: { type: string; payload?: unknown }) => {
      if (!teamId || !msg.payload) return

      if (msg.type === 'activity.created') {
        const incoming = msg.payload as Activity
        client.setQueriesData<Activity[]>(
          { queryKey: ['teams', teamId, 'activities'] },
          (old) => {
            if (!old) return old
            // Guard against duplicate delivery.
            if (old.some((a) => a.id === incoming.id)) return old
            return [...old, incoming]
          },
        )
      } else if (msg.type === 'activity.updated') {
        const incoming = msg.payload as Activity
        client.setQueriesData<Activity[]>(
          { queryKey: ['teams', teamId, 'activities'] },
          (old) => {
            if (!old) return old
            return old.map((a) => {
              if (a.id !== incoming.id) return a
              // Skip if the cache already holds the same or a newer version.
              const cachedMs = new Date(a.updatedAt).getTime()
              const incomingMs = new Date(incoming.updatedAt).getTime()
              return incomingMs > cachedMs ? incoming : a
            })
          },
        )
      } else if (msg.type === 'activity.deleted') {
        const { id } = msg.payload as { id: string }
        client.setQueriesData<Activity[]>(
          { queryKey: ['teams', teamId, 'activities'] },
          (old) => old?.filter((a) => a.id !== id),
        )
      }
    },
    [client, teamId],
  )

  useWebSocket({
    token: accessToken,
    teamIds: teamId ? [teamId] : [],
    onMessage: handleMessage,
  })
}

interface CreateActivityInput {
  title: string
  startAt: string
  endAt: string
  description?: string | null
  color?: string | null
  icon?: string | null
  assignedMemberIds?: string[]
}

interface UpdateActivityInput {
  activityId: string
  patch: {
    title?: string
    description?: string | null
    startAt?: string
    endAt?: string
    allDay?: boolean
    color?: string | null
    icon?: string | null
    location?: string | null
    url?: string | null
    assignedMemberIds?: string[]
  }
}

/** Creates an activity and inserts it directly into the cache. */
export function useCreateActivity(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateActivityInput) =>
      authFetch<Activity>(`/teams/${teamId}/activities`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (created) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['teams', teamId, 'activities'] },
        (old) => {
          if (!old) return old
          // WS self-echo may also insert this activity; deduplicate by id.
          if (old.some((a) => a.id === created.id)) return old
          return [...old, created]
        },
      )
    },
  })
}

/** PATCHes an activity and optimistically updates the cache. */
export function useUpdateActivity(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ activityId, patch }: UpdateActivityInput) =>
      authFetch<Activity>(`/activities/${activityId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (updated) => {
      // Update the activity in all matching cache entries for the team.
      client.setQueriesData<Activity[]>(
        { queryKey: ['teams', teamId, 'activities'] },
        (old) => old?.map((a) => (a.id === updated.id ? updated : a)),
      )
    },
  })
}

interface CreateTeamInput {
  name: string
  description?: string | null
  notes?: string | null
  color?: string | null
  icon?: string | null
}

interface UpdateTeamInput {
  teamId: string
  patch: {
    name?: string
    description?: string | null
    notes?: string | null
    color?: string | null
    icon?: string | null
  }
}

/** Creates a team and inserts it into the active-teams cache. */
export function useCreateTeam() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateTeamInput) =>
      authFetch<Team>('/teams', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // Invalidate both active and archived team lists.
      client.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

/** PATCHes a team's mutable fields and refreshes the cache. */
export function useUpdateTeam() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ teamId, patch }: UpdateTeamInput) =>
      authFetch<Team>(`/teams/${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

/** Archives a team (soft delete). */
export function useArchiveTeam() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (teamId: string) =>
      authFetch<Team>(`/teams/${teamId}/archive`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

/** Restores an archived team. */
export function useUnarchiveTeam() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (teamId: string) =>
      authFetch<Team>(`/teams/${teamId}/unarchive`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

/** Deletes an activity and removes it from the cache. */
export function useDeleteActivity(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (activityId: string) =>
      authFetch<void>(`/activities/${activityId}`, { method: 'DELETE' }),
    onSuccess: (_data, activityId) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['teams', teamId, 'activities'] },
        (old) => old?.filter((a) => a.id !== activityId),
      )
    },
  })
}
