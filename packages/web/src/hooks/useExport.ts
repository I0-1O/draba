/**
 * useExport — downloads a timeline export (CSV/Excel/ICS) via
 * POST /timelines/{id}/export.
 *
 * Phase 14.1: synchronous, single-shot — the response body is the file
 * itself, saved to disk via a temporary anchor element. No progress
 * reporting or job queue.
 */

import { useState } from 'react'
import { createAuthFetchBlob } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { buildExportFilename, type ExportFormatId } from '@/lib/exportCapabilities'
import type { FilterDefinition } from '@/lib/filterTypes'

export interface ExportViewConfig {
  filter?: FilterDefinition | null
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

export function useExport(timelineId: string, timelineName: string) {
  const { getAccessToken } = useAuth()
  const authFetchBlob = createAuthFetchBlob(getAccessToken)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const download = async (format: ExportFormatId, ext: string, viewConfig?: ExportViewConfig): Promise<void> => {
    setIsPending(true)
    setError(null)
    try {
      const { blob } = await authFetchBlob(`/timelines/${timelineId}/export`, {
        method: 'POST',
        body: JSON.stringify({
          format,
          ...(viewConfig?.filter ? { viewConfig: { filter: viewConfig.filter } } : {}),
        }),
      })
      saveBlob(blob, buildExportFilename(timelineName, ext))
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending, error }
}
