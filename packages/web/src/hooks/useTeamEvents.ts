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

type Event = components['schemas']['Event']
type Team = components['schemas']['Team']
type Timeline = components['schemas']['Timeline']
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']

/** Query key factory — centralises cache key strings. */
export const keys = {
  myTeams: () => ['teams'] as const,
  teamEvents: (teamId: string, from?: string, to?: string) =>
    ['teams', teamId, 'events', { from, to }] as const,
  teamMembers: (teamId: string) =>
    ['teams', teamId, 'members'] as const,
  teamTimelines: (teamId: string) =>
    ['teams', teamId, 'timelines'] as const,
}

/** Fetches all teams the authenticated user belongs to. */
export function useMyTeams() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.myTeams(),
    queryFn: () => authFetch<Team[]>('/teams'),
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
 * Subscribes to the team's WebSocket feed and applies surgical cache updates
 * for event.created / event.updated / event.deleted deltas.
 *
 * Conflict strategy: for event.updated, incoming deltas are only applied when
 * their updatedAt timestamp is strictly newer than the cached version. This
 * prevents self-echo (our own PATCH broadcast arriving back) and handles the
 * last-writer-wins case where a concurrent remote edit arrives while our
 * mutation is in-flight — the server-returned updatedAt on our onSuccess
 * will always win if our PATCH was truly last.
 */
export function useTeamEventSync(
  teamId: string,
  accessToken: string | null | undefined,
) {
  const client = useQueryClient()

  const handleMessage = useCallback(
    (msg: { type: string; payload?: unknown }) => {
      if (!teamId || !msg.payload) return

      if (msg.type === 'event.created') {
        const incoming = msg.payload as Event
        client.setQueriesData<Event[]>(
          { queryKey: ['teams', teamId, 'events'] },
          (old) => {
            if (!old) return old
            // Guard against duplicate delivery.
            if (old.some((e) => e.id === incoming.id)) return old
            return [...old, incoming]
          },
        )
      } else if (msg.type === 'event.updated') {
        const incoming = msg.payload as Event
        client.setQueriesData<Event[]>(
          { queryKey: ['teams', teamId, 'events'] },
          (old) => {
            if (!old) return old
            return old.map((e) => {
              if (e.id !== incoming.id) return e
              // Skip if the cache already holds the same or a newer version.
              const cachedMs = new Date(e.updatedAt).getTime()
              const incomingMs = new Date(incoming.updatedAt).getTime()
              return incomingMs > cachedMs ? incoming : e
            })
          },
        )
      } else if (msg.type === 'event.deleted') {
        const { id } = msg.payload as { id: string }
        client.setQueriesData<Event[]>(
          { queryKey: ['teams', teamId, 'events'] },
          (old) => old?.filter((e) => e.id !== id),
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

interface CreateEventInput {
  title: string
  startAt: string
  endAt: string
  description?: string | null
  color?: string | null
  assignedMemberIds?: string[]
}

interface UpdateEventInput {
  eventId: string
  patch: {
    title?: string
    description?: string | null
    startAt?: string
    endAt?: string
    allDay?: boolean
    color?: string | null
    location?: string | null
    url?: string | null
    assignedMemberIds?: string[]
  }
}

/** Creates an event and inserts it directly into the cache. */
export function useCreateEvent(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEventInput) =>
      authFetch<Event>(`/teams/${teamId}/events`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (created) => {
      client.setQueriesData<Event[]>(
        { queryKey: ['teams', teamId, 'events'] },
        (old) => {
          if (!old) return old
          // WS self-echo may also insert this event; deduplicate by id.
          if (old.some((e) => e.id === created.id)) return old
          return [...old, created]
        },
      )
    },
  })
}

/** PATCHes an event and optimistically updates the cache. */
export function useUpdateEvent(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ eventId, patch }: UpdateEventInput) =>
      authFetch<Event>(`/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: (updated) => {
      // Update the event in all matching cache entries for the team.
      client.setQueriesData<Event[]>(
        { queryKey: ['teams', teamId, 'events'] },
        (old) => old?.map((e) => (e.id === updated.id ? updated : e)),
      )
    },
  })
}

/** Deletes an event and removes it from the cache. */
export function useDeleteEvent(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (eventId: string) =>
      authFetch<void>(`/events/${eventId}`, { method: 'DELETE' }),
    onSuccess: (_data, eventId) => {
      client.setQueriesData<Event[]>(
        { queryKey: ['teams', teamId, 'events'] },
        (old) => old?.filter((e) => e.id !== eventId),
      )
    },
  })
}
