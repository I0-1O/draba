/**
 * ImportWizard — the "Bulk import" stepped dialog (Phase 15.2).
 *
 * Upload → map columns (only when auto-mapping left columns unmapped, or on
 * "Adjust mapping") → preview → commit + result. Every option change
 * (mapping, date order, create-missing-tags) re-runs the dry-run against the
 * stateless import endpoint, so the preview always shows exactly what a
 * commit would write. Modeled on ExportDialog's portal shell: overlay click
 * does not close, only Esc / the close button / Cancel do.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Upload, X, FileDown, Check, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import {
  useImportPreview, useCommitImport, useImportTemplate,
  type ImportResult, type ImportRequestOptions,
} from '@/hooks/useImport'
import { needsMappingStep, hasAmbiguousDates, importableCount } from './importFields'
import ImportMappingStep from './ImportMappingStep'
import ImportPreviewStep from './ImportPreviewStep'
import type { components } from '@draba/shared'

type Timeline = components['schemas']['Timeline']

export interface ImportWizardProps {
  teamId: string
  /** Active (non-archived) timelines for the target picker. */
  timelines: Timeline[]
  /** Pre-selected target — the currently viewed timeline. */
  activeTimelineId: string | null
  /** Switches the dashboard to the given timeline (result step's "View timeline"). */
  onGoToTimeline?: (timelineId: string) => void
  onClose: () => void
}

type Step = 'upload' | 'map' | 'preview' | 'result'

const STEP_TITLES: Record<Step, string> = {
  upload: 'Upload a file',
  map: 'Map columns',
  preview: 'Preview import',
  result: 'Import complete',
}

export default function ImportWizard({
  teamId,
  timelines,
  activeTimelineId,
  onGoToTimeline,
  onClose,
}: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload')
  const [timelineId, setTimelineId] = useState(activeTimelineId ?? timelines[0]?.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  // null = let the server auto-map; set once the user edits the mapping step.
  const [mappingOverride, setMappingOverride] = useState<Record<string, string> | null>(null)
  const [dateOrder, setDateOrder] = useState<'mdy' | 'dmy'>('mdy')
  const [createMissingTags, setCreateMissingTags] = useState(false)
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null)
  const [commitResult, setCommitResult] = useState<ImportResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const preview = useImportPreview(teamId)
  const commit = useCommitImport(teamId)
  const downloadTemplate = useImportTemplate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const buildOptions = useCallback((over?: Partial<ImportRequestOptions>): ImportRequestOptions => {
    // Explicit mapping sends only mapped columns — per the server contract,
    // columns absent from an explicit mapping are ignored (with a warning).
    const explicit = mappingOverride
      ? Object.fromEntries(Object.entries(mappingOverride).filter(([, f]) => f !== ''))
      : null
    return {
      mapping: explicit,
      dateOrder,
      createMissingTags,
      ...over,
    }
  }, [mappingOverride, dateOrder, createMissingTags])

  /** Runs the dry-run and lands on the given step (or picks map/preview from the result). */
  const runPreview = useCallback((f: File, options: ImportRequestOptions, landOn?: Step) => {
    setFileError(null)
    preview.mutate(
      { timelineId, file: f, options },
      {
        onSuccess: result => {
          setPreviewResult(result)
          setStep(landOn ?? (needsMappingStep(result) ? 'map' : 'preview'))
        },
        onError: err => {
          // File-scoped 400s (wrong type, too big, no Title column) send the
          // user back to the upload step with the server's message.
          setFileError(err instanceof ApiError ? err.message : 'Upload failed — try again.')
          setStep('upload')
        },
      },
    )
  }, [preview, timelineId])

  const handleFileChosen = (f: File) => {
    setFile(f)
    setMappingOverride(null)
    setCreateMissingTags(false)
    runPreview(f, buildOptions({ mapping: null, createMissingTags: false }))
  }

  const handleMappingChange = (mapping: Record<string, string>) => {
    setMappingOverride(mapping)
    if (!file) return
    const explicit = Object.fromEntries(Object.entries(mapping).filter(([, f]) => f !== ''))
    runPreview(file, buildOptions({ mapping: explicit }), 'map')
  }

  const handleDateOrderChange = (order: 'mdy' | 'dmy') => {
    setDateOrder(order)
    if (!file) return
    runPreview(file, buildOptions({ dateOrder: order }), 'map')
  }

  const handleCreateMissingTagsChange = (create: boolean) => {
    setCreateMissingTags(create)
    if (!file) return
    runPreview(file, buildOptions({ createMissingTags: create }), 'preview')
  }

  const handleCommit = () => {
    if (!file) return
    commit.mutate(
      { timelineId, file, options: buildOptions() },
      {
        onSuccess: result => {
          setCommitResult(result)
          setStep('result')
        },
      },
    )
  }

  const timelineName = timelines.find(t => t.id === timelineId)?.name ?? ''
  const importable = previewResult ? importableCount(previewResult) : 0

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(200_24%_11%/0.55)] p-6 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-[min(720px,100%)] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-5 py-[18px]">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(188_59%_38%/0.12)] text-primary">
            <Upload size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-bold leading-tight text-foreground">Bulk import</h2>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              {STEP_TITLES[step]}{timelineName ? ` · ${timelineName}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-[30px] w-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border-none bg-muted text-muted-foreground"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="import-timeline" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                  Import into
                </label>
                <select
                  id="import-timeline"
                  value={timelineId}
                  onChange={e => setTimelineId(e.target.value)}
                  className="h-9 w-full rounded-[var(--radius-md)] border border-input bg-background px-2.5 text-[13px] text-foreground"
                >
                  {timelines.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div
                role="button"
                tabIndex={0}
                aria-label="Choose a file to import"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFileChosen(f)
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragOver ? 'border-primary bg-[hsl(188_59%_38%/0.06)]' : 'border-border hover:bg-muted/50',
                )}
              >
                {preview.isPending
                  ? <Loader2 size={22} strokeWidth={2} className="animate-spin text-primary" />
                  : <Upload size={22} strokeWidth={1.8} className="text-muted-foreground" />}
                <div className="text-[13.5px] font-semibold text-foreground">
                  {preview.isPending ? 'Checking file…' : 'Drop a CSV or Excel file here'}
                </div>
                <div className="text-[12px] text-muted-foreground">or click to choose · .csv / .xlsx · up to 2 MB, 2,000 rows</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  aria-label="Import file"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleFileChosen(f)
                    e.target.value = '' // allow re-selecting the same file after a fix
                  }}
                />
              </div>

              {fileError && (
                <div className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-[12.5px] text-destructive">
                  {fileError}
                </div>
              )}

              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <FileDown size={14} strokeWidth={2} className="shrink-0" />
                Need a starting point? Download the template:
                <button type="button" onClick={() => void downloadTemplate('csv')} className="cursor-pointer border-none bg-transparent p-0 font-semibold text-primary underline">CSV</button>
                ·
                <button type="button" onClick={() => void downloadTemplate('xlsx')} className="cursor-pointer border-none bg-transparent p-0 font-semibold text-primary underline">Excel</button>
              </div>
            </div>
          )}

          {step === 'map' && previewResult && (
            <ImportMappingStep
              mapping={mappingOverride ?? previewResult.mapping}
              onMappingChange={handleMappingChange}
              showDateOrder={hasAmbiguousDates(previewResult)}
              dateOrder={dateOrder}
              onDateOrderChange={handleDateOrderChange}
            />
          )}

          {step === 'preview' && previewResult && (
            <ImportPreviewStep
              result={previewResult}
              createMissingTags={createMissingTags}
              onCreateMissingTagsChange={handleCreateMissingTagsChange}
              revalidating={preview.isPending}
            />
          )}

          {step === 'result' && commitResult && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)]">
                <Check size={26} strokeWidth={2.4} className="text-success" />
              </div>
              <div className="text-[16px] font-bold text-foreground">
                {commitResult.summary.created} {commitResult.summary.created === 1 ? 'activity' : 'activities'} imported
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                into {timelineName}
                {commitResult.summary.errors > 0 && (
                  <> · {commitResult.summary.errors} {commitResult.summary.errors === 1 ? 'row' : 'rows'} skipped (errors)</>
                )}
              </div>
            </div>
          )}

          {commit.isError && step === 'preview' && (
            <div className="mt-3 shrink-0 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] px-3 py-2 text-[12.5px] text-destructive">
              {commit.error instanceof ApiError ? commit.error.message : 'Import failed — nothing was written. Try again.'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-[13px]">
          {step === 'map' && (
            <Button variant="ghost" onClick={() => setStep('upload')} className="gap-1.5">
              <ArrowLeft size={14} strokeWidth={2.2} /> Back
            </Button>
          )}
          {step === 'preview' && (
            <Button variant="ghost" onClick={() => setStep('map')} className="gap-1.5">
              <ArrowLeft size={14} strokeWidth={2.2} /> Adjust mapping
            </Button>
          )}
          <div className="flex-1" />
          {step !== 'result' && <Button variant="outline" onClick={onClose}>Cancel</Button>}
          {step === 'map' && (
            <Button onClick={() => setStep('preview')} disabled={preview.isPending}>
              Continue to preview
            </Button>
          )}
          {step === 'preview' && (
            <Button
              onClick={handleCommit}
              disabled={importable === 0 || preview.isPending || commit.isPending}
              className="min-w-[168px] justify-center"
            >
              {commit.isPending
                ? <><Loader2 size={14} strokeWidth={2.2} className="animate-spin" /> Importing…</>
                : `Import ${importable} ${importable === 1 ? 'activity' : 'activities'}`}
            </Button>
          )}
          {step === 'result' && (
            <>
              {onGoToTimeline && timelineId !== activeTimelineId && (
                <Button variant="outline" onClick={() => { onGoToTimeline(timelineId); onClose() }}>
                  View timeline
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
