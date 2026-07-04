/**
 * TanStack mutation hooks for the Phase 15 bulk import endpoint.
 *
 * Preview and commit are the same stateless endpoint with `dryRun` toggled —
 * the commit re-uploads the identical file so the two passes cannot diverge.
 * useCommitImport invalidates the target timeline's activity queries so the
 * imported rows appear without waiting for the WebSocket event fan-out.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { components } from '@draba/shared'
import { createAuthFetch, createAuthFetchBlob } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

export type ImportResult = components['schemas']['ImportResult']
export type ImportRowResult = components['schemas']['ImportRowResult']
export type ImportIssue = components['schemas']['ImportIssue']

/** Client-side options for one import pass; `dryRun` is set by the hook. */
export interface ImportRequestOptions {
  /** File column header → field name; omitted = server auto-mapping. */
  mapping?: Record<string, string> | null
  /** Only consulted when the file's numeric dates stay ambiguous column-wide. */
  dateOrder?: 'mdy' | 'dmy'
  createMissingTags?: boolean
}

export interface ImportRequest {
  timelineId: string
  file: File
  options: ImportRequestOptions
}

function buildFormData(file: File, options: ImportRequestOptions, dryRun: boolean): FormData {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('options', JSON.stringify({
    dryRun,
    ...(options.mapping ? { mapping: options.mapping } : {}),
    ...(options.dateOrder ? { dateOrder: options.dateOrder } : {}),
    ...(options.createMissingTags ? { createMissingTags: true } : {}),
  }))
  return fd
}

/** Dry-run pass: parse + validate, write nothing. Safe to re-run on every option change. */
export function useImportPreview(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  return useMutation({
    mutationFn: ({ timelineId, file, options }: ImportRequest) =>
      authFetch<ImportResult>(`/teams/${teamId}/timelines/${timelineId}/import`, {
        method: 'POST',
        body: buildFormData(file, options, true),
      }),
  })
}

/** Commit pass: re-parses the identical upload and writes the accepted rows in one transaction. */
export function useCommitImport(teamId: string) {
  const { getAccessToken } = useAuth()
  const authFetch = createAuthFetch(getAccessToken)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ timelineId, file, options }: ImportRequest) =>
      authFetch<ImportResult>(`/teams/${teamId}/timelines/${timelineId}/import`, {
        method: 'POST',
        body: buildFormData(file, options, false),
      }),
    onSuccess: (_result, { timelineId }) => {
      void qc.invalidateQueries({ queryKey: ['timelines', timelineId, 'activities'] })
      // Opted-in tag creation changes the team tag list too.
      void qc.invalidateQueries({ queryKey: ['teams', teamId, 'tags'] })
    },
  })
}

/** Triggers the browser to save a Blob with the given filename. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Downloads the import template (`csv` or `xlsx`). The template routes are
 * authenticated, so a plain <a href> won't do — fetch with the token and save.
 */
export function useImportTemplate() {
  const { getAccessToken } = useAuth()
  const authFetchBlob = createAuthFetchBlob(getAccessToken)
  return async (format: 'csv' | 'xlsx'): Promise<void> => {
    const { blob, filename } = await authFetchBlob(`/import/template.${format}`)
    saveBlob(blob, filename ?? `draba-import-template.${format}`)
  }
}
