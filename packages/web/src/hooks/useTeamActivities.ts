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
type TimelineAccessEntry = components['schemas']['TimelineAccessEntry']
type PatchTimelineInput = components['schemas']['PatchTimelineInput']

/** Query key factory — centralises cache key strings. */
export const keys = {
  myTeams: () => ['teams'] as const,
  timelineActivities: (timelineId: string, from?: string, to?: string) =>
    ['timelines', timelineId, 'activities', { from, to }] as const,
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
    queryFn: async () => (await authFetch<Team[] | null>(includeArchived ? '/teams?archived=true' : '/teams')) ?? [],
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
    queryFn: async () => (await authFetch<Timeline[] | null>(`/teams/${teamId}/timelines`)) ?? [],
    enabled: Boolean(teamId),
  })
}

/** Fetches activities for a timeline, optionally bounded by date range. */
export function useTimelineActivities(teamId: string, timelineId: string, from?: string, to?: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.timelineActivities(timelineId, from, to),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const qs = params.toString()
      return (await authFetch<Activity[] | null>(`/teams/${teamId}/timelines/${timelineId}/activities${qs ? `?${qs}` : ''}`)) ?? []
    },
    enabled: Boolean(teamId) && Boolean(timelineId),
  })
}

/** Fetches the member list for a team. */
export function useTeamMembers(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: keys.teamMembers(teamId),
    queryFn: async () => (await authFetch<TeamMemberWithUser[] | null>(`/teams/${teamId}/members`)) ?? [],
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
        // Target all timeline-scoped activity cache entries by using the
        // timelineId from the incoming activity payload.
        if (!incoming.timelineId) return
        client.setQueriesData<Activity[]>(
          { queryKey: ['timelines', incoming.timelineId, 'activities'] },
          (old) => {
            if (!old) return old
            // Guard against duplicate delivery.
            if (old.some((a) => a.id === incoming.id)) return old
            return [...old, incoming]
          },
        )
      } else if (msg.type === 'activity.updated') {
        const incoming = msg.payload as Activity
        if (!incoming.timelineId) return
        client.setQueriesData<Activity[]>(
          { queryKey: ['timelines', incoming.timelineId, 'activities'] },
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
        // activity.deleted payload only has id — invalidate all timeline
        // activity queries for this team so caches stay consistent.
        client.invalidateQueries({ queryKey: ['timelines'] })
        // Optimistically remove from all cached timeline activity lists.
        client.setQueriesData<Activity[]>(
          { queryKey: ['timelines'] },
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
  tagIds?: string[]
  parentActivityId?: string | null
  percentComplete?: number | null
}

interface UpdateActivityInput {
  activityId: string
  patch: {
    title?: string
    description?: string | null
    notes?: string | null
    startAt?: string
    endAt?: string
    allDay?: boolean
    color?: string | null
    icon?: string | null
    location?: string | null
    url?: string | null
    statusId?: string | null
    parentActivityId?: string | null
    percentComplete?: number | null
    assignedMemberIds?: string[]
    tagIds?: string[]
  }
}

/** Creates an activity in a timeline and inserts it directly into the cache. */
export function useCreateActivity(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateActivityInput) =>
      authFetch<Activity>(`/teams/${teamId}/timelines/${timelineId}/activities`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (created) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['timelines', timelineId, 'activities'] },
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
export function useUpdateActivity(timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ activityId, patch }: UpdateActivityInput) =>
      authFetch<Activity>(`/activities/${activityId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onMutate: async ({ activityId, patch }) => {
      await client.cancelQueries({ queryKey: ['timelines', timelineId, 'activities'] })
      const snapshot = client.getQueriesData<Activity[]>({ queryKey: ['timelines', timelineId, 'activities'] })
      client.setQueriesData<Activity[]>(
        { queryKey: ['timelines', timelineId, 'activities'] },
        (old) => old?.map((a) => (a.id === activityId ? { ...a, ...patch } : a)),
      )
      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        for (const [key, data] of context.snapshot) {
          client.setQueryData(key, data)
        }
      }
    },
    onSuccess: (updated) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['timelines', timelineId, 'activities'] },
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

/** Archives an activity (soft-delete). Removes it from the active-list cache. */
export function useArchiveActivity(timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (activityId: string) =>
      authFetch<Activity>(`/activities/${activityId}/archive`, { method: 'POST' }),
    onSuccess: (_data, activityId) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['timelines', timelineId, 'activities'] },
        (old) => old?.filter((a) => a.id !== activityId),
      )
    },
  })
}

/** Deletes an activity and removes it from the cache. */
export function useDeleteActivity(timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (activityId: string) =>
      authFetch<void>(`/activities/${activityId}`, { method: 'DELETE' }),
    onSuccess: (_data, activityId) => {
      client.setQueriesData<Activity[]>(
        { queryKey: ['timelines', timelineId, 'activities'] },
        (old) => old?.filter((a) => a.id !== activityId),
      )
    },
  })
}

// ── Timeline CRUD (Phase 10.3) ────────────────────────────────────────────────

/** Fetches all timelines for a team, optionally including archived ones. */
export function useTeamTimelinesWithArchived(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: [...keys.teamTimelines(teamId), { includeArchived: true }],
    queryFn: async () =>
      (await authFetch<Timeline[] | null>(`/teams/${teamId}/timelines?archived=true`)) ?? [],
    enabled: Boolean(teamId),
  })
}

/** Creates a new timeline for a team. */
export function useCreateTimeline(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string; startDate: string; endDate: string; color?: string | null; icon?: string | null; description?: string | null; notes?: string | null; templateId?: string | null }) =>
      authFetch<Timeline>(`/teams/${teamId}/timelines`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.teamTimelines(teamId) })
    },
  })
}

/** PATCHes a timeline's mutable fields. */
export function useUpdateTimeline(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ timelineId, patch }: { timelineId: string; patch: PatchTimelineInput }) =>
      authFetch<Timeline>(`/timelines/${timelineId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.teamTimelines(teamId) })
    },
  })
}

/** Hard-deletes a timeline. */
export function useDeleteTimeline(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (timelineId: string) =>
      authFetch<void>(`/timelines/${timelineId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.teamTimelines(teamId) })
    },
  })
}

/** Archives a timeline. */
export function useArchiveTimeline(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (timelineId: string) =>
      authFetch<Timeline>(`/timelines/${timelineId}/archive`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.teamTimelines(teamId) })
    },
  })
}

/** Restores an archived timeline. */
export function useUnarchiveTimeline(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (timelineId: string) =>
      authFetch<Timeline>(`/timelines/${timelineId}/unarchive`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.teamTimelines(teamId) })
    },
  })
}

/** Fetches the access grant list for a timeline. */
export function useTimelineAccess(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: ['teams', teamId, 'timelines', timelineId, 'access'],
    queryFn: async () =>
      (await authFetch<TimelineAccessEntry[]>(
        `/teams/${teamId}/timelines/${timelineId}/access`,
      )) ?? [],
    enabled: Boolean(teamId) && Boolean(timelineId),
  })
}

/** Grants or updates a member's access to a timeline. */
export function useGrantTimelineAccess(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'admin' | 'member' }) =>
      authFetch<TimelineAccessEntry[]>(
        `/teams/${teamId}/timelines/${timelineId}/access/${memberId}`,
        { method: 'PUT', body: JSON.stringify({ role }) },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'timelines', timelineId, 'access'] })
    },
  })
}

/** Revokes a member's access to a timeline. */
export function useRevokeTimelineAccess(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      authFetch<void>(`/teams/${teamId}/timelines/${timelineId}/access/${memberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'timelines', timelineId, 'access'] })
    },
  })
}
