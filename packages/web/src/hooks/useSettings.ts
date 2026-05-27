/**
 * TanStack Query hooks for the settings API endpoints shipped in Phase 10.1.3:
 * profile, password change, forgot/reset password, SMTP config, instance
 * settings, and the admin user list.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch, createAuthFetch } from '@/lib/api'
import type { components } from '@draba/shared'

type User = components['schemas']['User']
type SMTPConfig = components['schemas']['SMTPConfig']
type APIToken = components['schemas']['APIToken']

// ── Profile ──────────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  const { getAccessToken, patchUser } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: { displayName?: string; color?: string | null; icon?: string | null }) =>
      authFetch<User>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(['me'], updated)
      patchUser(updated)
      // Invalidate all team member lists so the sidebar reflects the new color/icon.
      void qc.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

// ── My stats ──────────────────────────────────────────────────────────────────

interface MemberStats {
  activeTimelines: number
  archivedTimelines: number
  pastDue: number
  running: number
  upcoming: number
  unscheduled: number
  archivedActivities: number
}

export function useMyStats() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: ['me', 'stats'],
    queryFn: () => authFetch<MemberStats>('/users/me/stats'),
  })
}

// ── Password ──────────────────────────────────────────────────────────────────

export function useChangePassword() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      authFetch<{ status: string }>('/users/me/password', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  })
}

// ── Forgot / reset password (public, no auth required) ───────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ status: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      apiFetch<{ status: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}

// ── Admin: SMTP ──────────────────────────────────────────────────────────────

export function useAdminSMTP() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: ['admin', 'smtp'],
    queryFn: () => authFetch<{ smtp: SMTPConfig | null }>('/admin/smtp'),
  })
}

export function useSaveSMTP() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (cfg: SMTPConfig) =>
      authFetch<{ smtp: SMTPConfig }>('/admin/smtp', {
        method: 'PUT',
        body: JSON.stringify(cfg),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'smtp'] }),
  })
}

export function useTestSMTP() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useMutation({
    mutationFn: (cfg: SMTPConfig) =>
      authFetch<{ status: string; to: string }>('/admin/smtp/test', {
        method: 'POST',
        body: JSON.stringify(cfg),
      }),
  })
}

export function useDeleteSMTP() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () =>
      authFetch<void>('/admin/smtp', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'smtp'] }),
  })
}

// ── Admin: Instance settings ──────────────────────────────────────────────────

export function useAdminSettings() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => authFetch<{ settings: Record<string, string> }>('/admin/settings'),
  })
}

export function usePatchAdminSettings() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      authFetch<{ settings: Record<string, string> }>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })
}

// ── API Tokens ────────────────────────────────────────────────────────────────

export function useTokens() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useQuery({
    queryKey: ['tokens'],
    queryFn: () => authFetch<APIToken[]>('/tokens'),
  })
}

export function useCreateToken() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; scope: string }) =>
      authFetch<{ token: APIToken; rawValue: string }>('/tokens', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  })
}

export function useRevokeToken() {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/tokens/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  })
}

// ── Admin: Users ──────────────────────────────────────────────────────────────

export type AdminUserRow = User & { teamCount: number }

export function useAdminUsers(orphanedOnly = false) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: ['admin', 'users', { orphanedOnly }],
    queryFn: () =>
      authFetch<{ users: AdminUserRow[] }>(`/admin/users${orphanedOnly ? '?orphaned=true' : ''}`),
  })
}
