/**
 * TanStack Query hooks for status templates and timeline statuses.
 *
 * Status templates are team-level reusable presets. When a timeline is
 * created the team's first template's items are copied into live Status rows
 * for that timeline.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

type StatusTemplate = components['schemas']['StatusTemplate']
type StatusTemplateItem = components['schemas']['StatusTemplateItem']
type Status = components['schemas']['Status']
type CreateStatusTemplateInput = components['schemas']['CreateStatusTemplateInput']
type PatchStatusTemplateInput = components['schemas']['PatchStatusTemplateInput']
type CreateStatusTemplateItemInput = components['schemas']['CreateStatusTemplateItemInput']
type PatchStatusTemplateItemInput = components['schemas']['PatchStatusTemplateItemInput']

export const statusKeys = {
  templates: (teamId: string) => ['teams', teamId, 'status-templates'] as const,
  statuses: (teamId: string, timelineId: string) =>
    ['teams', teamId, 'timelines', timelineId, 'statuses'] as const,
}

/** Fetches all status templates for a team. */
export function useStatusTemplates(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: statusKeys.templates(teamId),
    queryFn: async () =>
      (await authFetch<StatusTemplate[]>(`/teams/${teamId}/status-templates`)) ?? [],
    enabled: Boolean(teamId),
  })
}

/** Creates a new status template for a team. */
export function useCreateStatusTemplate(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateStatusTemplateInput) =>
      authFetch<StatusTemplate>(`/teams/${teamId}/status-templates`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Updates a status template (name, description, position). */
export function useUpdateStatusTemplate(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...patch }: PatchStatusTemplateInput & { id: string }) =>
      authFetch<StatusTemplate>(`/status-templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Deletes a status template. The server blocks deleting the last template. */
export function useDeleteStatusTemplate(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/status-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Adds an item to a status template. */
export function useCreateTemplateItem(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ templateId, ...input }: CreateStatusTemplateItemInput & { templateId: string }) =>
      authFetch<StatusTemplateItem>(`/status-templates/${templateId}/items`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Updates a template item (name, color, icon, isClosed, position). */
export function useUpdateTemplateItem(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...patch }: PatchStatusTemplateItemInput & { id: string }) =>
      authFetch<StatusTemplateItem>(`/status-template-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Deletes a template item. The server blocks deleting the last item. */
export function useDeleteTemplateItem(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      authFetch<void>(`/status-template-items/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: statusKeys.templates(teamId) }),
  })
}

/** Fetches live statuses for a timeline. */
export function useTimelineStatuses(teamId: string, timelineId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)

  return useQuery({
    queryKey: statusKeys.statuses(teamId, timelineId),
    queryFn: async () =>
      (await authFetch<Status[]>(`/teams/${teamId}/timelines/${timelineId}/statuses`)) ?? [],
    enabled: Boolean(teamId) && Boolean(timelineId),
  })
}
