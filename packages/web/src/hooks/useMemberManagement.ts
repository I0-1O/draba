/**
 * TanStack Query hooks for member management, invites, and superadmin actions.
 *
 * Separated from useTeamActivities.ts because member CRUD is a distinct
 * concern and this file would otherwise become unwieldy.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type TeamMemberWithUser = components['schemas']['TeamMemberWithUser']
type MemberDetail = components['schemas']['MemberDetail']
type Invite = components['schemas']['Invite']
type InviteLink = components['schemas']['InviteLink']
type User = components['schemas']['User']

// ── Query keys ─────────────────────────────────────────────────────────────

export const memberKeys = {
  member: (teamId: string, memberId: string) => ['teams', teamId, 'members', memberId] as const,
  invites: (teamId: string) => ['teams', teamId, 'invites'] as const,
  inviteLink: (teamId: string) => ['teams', teamId, 'invite-link'] as const,
  userSearch: (q: string) => ['users', 'search', q] as const,
}

// ── Member detail ───────────────────────────────────────────────────────────

/** Fetches a single team member with computed stats. */
export function useMemberDetail(teamId: string, memberId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: memberKeys.member(teamId, memberId),
    queryFn: () => authFetch<MemberDetail>(`/teams/${teamId}/members/${memberId}`),
    enabled: Boolean(teamId) && Boolean(memberId),
  })
}

// ── Member mutations ────────────────────────────────────────────────────────

interface UpdateMemberInput {
  displayName?: string | null
  color?: string | null
  icon?: string | null
  role?: 'admin' | 'member'
}

/** PATCHes a team member's display name, identity, or role. */
export function useUpdateMember(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, patch }: { memberId: string; patch: UpdateMemberInput }) =>
      authFetch<TeamMemberWithUser>(`/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

/** Adds an existing registered user to a team by their userId. */
export function useAddMember(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role?: 'admin' | 'member' }) =>
      authFetch<TeamMemberWithUser>(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId, role: role ?? 'member' }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

/** Removes a team member row. */
export function useDeleteMember(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      authFetch<void>(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

/** Inactivates a team member. */
export function useArchiveMember(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      authFetch<TeamMemberWithUser>(`/teams/${teamId}/members/${memberId}/archive`, {
        method: 'POST',
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

/** Reactivates an inactivated team member. */
export function useUnarchiveMember(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) =>
      authFetch<TeamMemberWithUser>(`/teams/${teamId}/members/${memberId}/unarchive`, {
        method: 'POST',
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

/** Creates a login-less participant. */
export function useCreateParticipant(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ name, color, icon }: { name: string; color?: string | null; icon?: string | null }) =>
      authFetch<TeamMemberWithUser>(`/teams/${teamId}/participants`, {
        method: 'POST',
        body: JSON.stringify({ name, color, icon }),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['teams', teamId, 'members'] })
    },
  })
}

// ── Invites ─────────────────────────────────────────────────────────────────

/** Lists pending invites for a team. */
export function useTeamInvites(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: memberKeys.invites(teamId),
    // Normalize null → [] so callers can safely use .length / .map
    queryFn: async () => (await authFetch<Invite[] | null>(`/teams/${teamId}/invites`)) ?? [],
    enabled: Boolean(teamId),
  })
}

/** Revokes a pending invite. */
export function useRevokeInvite(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: (inviteId: string) =>
      authFetch<void>(`/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: memberKeys.invites(teamId) })
    },
  })
}

// ── Invite link ─────────────────────────────────────────────────────────────

/** Gets the current reusable invite link token. */
export function useTeamInviteLink(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: memberKeys.inviteLink(teamId),
    queryFn: () => authFetch<InviteLink>(`/teams/${teamId}/invite-link`),
    enabled: Boolean(teamId),
  })
}

/** Generates or regenerates the reusable invite link. */
export function useCreateInviteLink(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      authFetch<InviteLink>(`/teams/${teamId}/invite-link`, { method: 'POST' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: memberKeys.inviteLink(teamId) })
    },
  })
}

/** Revokes the reusable invite link. */
export function useRevokeInviteLink(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const client = useQueryClient()

  return useMutation({
    mutationFn: () =>
      authFetch<void>(`/teams/${teamId}/invite-link`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: memberKeys.inviteLink(teamId) })
    },
  })
}

// ── User search ─────────────────────────────────────────────────────────────

/** Searches users by name or email. Query must be ≥2 chars. */
export function useUserSearch(q: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: memberKeys.userSearch(q),
    queryFn: async () => (await authFetch<User[] | null>(`/users/search?q=${encodeURIComponent(q)}`)) ?? [],
    enabled: q.length >= 2,
  })
}

// ── Superadmin actions ──────────────────────────────────────────────────────

/** Promotes a user to superadmin. */
export function usePromoteUser() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (userId: string) =>
      authFetch<User>(`/users/${userId}/promote`, { method: 'POST' }),
  })
}

/** Inactivates a user account. */
export function useArchiveUser() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (userId: string) =>
      authFetch<User>(`/users/${userId}/archive`, { method: 'POST' }),
  })
}

/** Reactivates an inactivated user account. */
export function useUnarchiveUser() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (userId: string) =>
      authFetch<User>(`/users/${userId}/unarchive`, { method: 'POST' }),
  })
}

/** Hard-deletes a user. Only succeeds when the user is deletable. */
export function useDeleteUser() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (userId: string) =>
      authFetch<void>(`/users/${userId}`, { method: 'DELETE' }),
  })
}
