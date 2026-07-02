/**
 * ExportDialog — "Export this view" modal (Phase 14).
 *
 * Built to the export-modal design handoff (docs/design/handoffs/export-modal):
 * a format rail + options pane two-pane body, a filter context strip that
 * makes "export what I'm seeing" visible, and a scope picker (current view vs
 * entire timeline) for the data formats. Modeled on ShareModal's portal shell,
 * but — per the handoff — the overlay click does not close the dialog, only
 * Esc / the close button / Cancel do.
 *
 * 14.1 implements the server-side data/calendar formats (CSV, Excel, ICS).
 * 14.2 adds client-side textual formats (Markdown, Plain text, Copy to clipboard)
 *      via the `textExportData` prop; these formats only appear for non-Gantt views.
 * 14.3 adds the PNG snapshot format, rasterizing `captureElement` (the live
 *      view container) via `lib/pngExport.ts`; available in every view.
 * 14.4 adds the printable-view and HTML-save formats, both driven off the
 *      `presentationFrame` prop (the mounted PresentationFrame iframe) via
 *      `lib/printExport.ts` / `lib/htmlExport.ts`; available in every view.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FileOutput, Filter, AlertTriangle, Download, FileDown, Check, X, Copy, Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useExport } from '@/hooks/useExport'
import {
  getExportFormats, buildExportFilename,
  type ExportFormatId, type ExportViewType,
} from '@/lib/exportCapabilities'
import {
  buildListMarkdown, buildListMarkdownOutline,
  buildKanbanMarkdown, buildCalendarMarkdown,
  buildListPlainText, buildListPlainTextOutline,
  buildKanbanPlainText, buildCalendarPlainText,
  buildListHtml, buildListHtmlOutline, buildKanbanHtml, buildCalendarHtml,
  type TextExportData,
} from '@/lib/textExport'
import { capturePngSnapshot } from '@/lib/pngExport'
import { printPresentationFrame } from '@/lib/printExport'
import { saveFramePresentationHtml } from '@/lib/htmlExport'
import type { FilterDefinition } from '@/lib/filterTypes'

export type { TextExportData }

export interface ExportDialogProps {
  view: ExportViewType
  teamId: string
  timelineId: string
  timelineName: string
  /** Team display name, shown in the PNG header strip alongside the timeline name. */
  teamName?: string | null
  /** Display label for the active filter (e.g. a saved filter's name), or null if no filter is active. */
  filterLabel: string | null
  /** The active filter's definition, sent to the server when scope is "view" and activityIds is absent. */
  filterDefinition: FilterDefinition | null
  /** Number of activities matching the active filter (or totalCount when no filter is active). */
  filteredCount: number
  /** Total number of activities in the timeline, regardless of filter. */
  totalCount: number
  /**
   * Ordered activity IDs for the "current view" scope — covers preset/member
   * filters (which can't be sent as a FilterDefinition) and list-view sort order.
   * When non-null, takes precedence over filterDefinition in the request body.
   */
  viewActivityIds: string[] | null
  /**
   * Export column names to include in CSV/Excel (list view column visibility).
   * Null means all columns. Only meaningful for csv/xlsx formats.
   */
  listExportColumns: string[] | null
  /**
   * Pre-resolved in-memory data for client-side textual formats (14.2).
   * Required for Markdown / plain text / clipboard options to be functional;
   * if absent those formats still appear but will produce empty output.
   */
  textExportData?: TextExportData | null
  /**
   * The live view container to rasterize for the PNG format (14.3).
   * Required for PNG to be functional; if absent the format still appears
   * but the action is a no-op.
   */
  captureElement?: HTMLElement | null
  /**
   * The mounted PresentationFrame's iframe — the shared render surface for
   * the printable-view and HTML-save formats (14.4). Required for those
   * formats to be functional; if absent the actions are a no-op.
   */
  presentationFrame?: HTMLIFrameElement | null
  /**
   * Period label for the PNG header (Calendar only) — e.g. "June 2026" or
   * "Jun 1 – 7, 2026". The on-screen toolbar carries this, but it's excluded
   * from the capture, so it's surfaced into the header strip instead.
   */
  periodLabel?: string | null
  onClose: () => void
}

const VIEW_LABELS: Record<ExportViewType, string> = {
  gantt: 'Gantt',
  list: 'List',
  kanban: 'Kanban',
  calendar: 'Calendar',
}

type Scope = 'view' | 'all'

// ── Client-side text generation ────────────────────────────────────────────────

type ListStyle = 'table' | 'outline'

function generateMarkdown(view: ExportViewType, data: TextExportData, timelineName: string, filterLabel: string | null, listStyle: ListStyle): string {
  if (view === 'list') return listStyle === 'outline'
    ? buildListMarkdownOutline(data, timelineName, filterLabel)
    : buildListMarkdown(data, timelineName, filterLabel)
  if (view === 'kanban') return buildKanbanMarkdown(data, timelineName, filterLabel)
  if (view === 'calendar') return buildCalendarMarkdown(data, timelineName, filterLabel)
  return buildListMarkdown(data, timelineName, filterLabel)
}

function generatePlainText(view: ExportViewType, data: TextExportData, timelineName: string, filterLabel: string | null, listStyle: ListStyle): string {
  if (view === 'list') return listStyle === 'outline'
    ? buildListPlainTextOutline(data, timelineName, filterLabel)
    : buildListPlainText(data, timelineName, filterLabel)
  if (view === 'kanban') return buildKanbanPlainText(data, timelineName, filterLabel)
  if (view === 'calendar') return buildCalendarPlainText(data, timelineName, filterLabel)
  return buildListPlainText(data, timelineName, filterLabel)
}

function generateHtml(view: ExportViewType, data: TextExportData, timelineName: string, filterLabel: string | null, listStyle: ListStyle): string {
  if (view === 'list') return listStyle === 'outline'
    ? buildListHtmlOutline(data, timelineName, filterLabel)
    : buildListHtml(data, timelineName, filterLabel)
  if (view === 'kanban') return buildKanbanHtml(data, timelineName, filterLabel)
  if (view === 'calendar') return buildCalendarHtml(data, timelineName, filterLabel)
  return buildListHtml(data, timelineName, filterLabel)
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
 * Writes `text/plain` + `text/html` flavors to the clipboard so the paste
 * lands rich in Slack / Word / Google Docs and clean in code editors.
 * Falls back to `writeText` if `ClipboardItem` is unavailable (HTTP contexts).
 */
async function copyToClipboard(plainText: string, htmlText: string): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    const item = new ClipboardItem({
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
      'text/html': new Blob([htmlText], { type: 'text/html' }),
    })
    await navigator.clipboard.write([item])
  } else {
    // Fallback for HTTP (non-localhost) contexts where ClipboardItem is blocked.
    await navigator.clipboard.writeText(plainText)
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ExportDialog({
  view,
  timelineId,
  timelineName,
  teamName,
  filterLabel,
  filterDefinition,
  filteredCount,
  totalCount,
  viewActivityIds,
  listExportColumns,
  textExportData,
  captureElement,
  presentationFrame,
  periodLabel,
  onClose,
}: ExportDialogProps) {
  const formats = getExportFormats(view)
  const [formatId, setFormatId] = useState<ExportFormatId>('csv')
  const [scope, setScope] = useState<Scope>('view')
  const [listStyle, setListStyle] = useState<ListStyle>('table')
  const [done, setDone] = useState(false)
  const [clientPending, setClientPending] = useState(false)
  const { download, isPending: serverPending } = useExport(timelineId, timelineName)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const format = formats.find(f => f.id === formatId) ?? formats[0]
  const Icon = format.icon
  const isPending = serverPending || clientPending

  // Client-side formats (PNG / Markdown / plain text) are inherently shaped by
  // the active view, so their filename names it. Server data formats (CSV /
  // xlsx / ICS) can be scoped to the whole timeline, where a view name would
  // mislead — they keep the plain `<timeline>-<date>` name.
  const filenameView = format.clientSide ? view : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => () => { if (doneTimer.current) clearTimeout(doneTimer.current) }, [])

  const selectFormat = (id: ExportFormatId) => {
    setFormatId(id)
    setDone(false)
  }

  const flashDone = useCallback(() => {
    setDone(true)
    doneTimer.current = setTimeout(() => setDone(false), 1600)
  }, [])

  const handleAction = useCallback(() => {
    if (format.id === 'png') {
      if (!captureElement) return
      setClientPending(true)
      capturePngSnapshot(captureElement, { timelineName, teamName: teamName ?? null, filterLabel, periodLabel })
        .then(blob => { saveBlob(blob, buildExportFilename(timelineName, format.ext, view)); flashDone() })
        .catch(() => { /* capture may fail on unsupported browsers */ })
        .finally(() => setClientPending(false))
      return
    }

    if (format.id === 'printable') {
      if (!presentationFrame) return
      printPresentationFrame(presentationFrame, { timelineName, teamName: teamName ?? null, filterLabel, periodLabel })
      flashDone()
      return
    }

    if (format.id === 'html') {
      if (!presentationFrame) return
      setClientPending(true)
      saveFramePresentationHtml(
        presentationFrame,
        { timelineName, teamName: teamName ?? null, filterLabel, periodLabel },
        buildExportFilename(timelineName, format.ext, view),
      )
        .then(() => flashDone())
        .catch(() => { /* stylesheet fetch may fail offline; nothing was saved */ })
        .finally(() => setClientPending(false))
      return
    }

    if (format.clientSide) {
      const data = textExportData ?? {
        activities: [],
        memberById: new Map(),
        statusById: new Map(),
        tagById: new Map(),
        activityTitleById: new Map(),
        kanbanColumns: null,
        listDisplayRows: null,
        listVisibleColumns: null,
        kanbanShowHierarchy: false,
        kanbanChildrenByParentId: new Map(),
      }

      if (format.id === 'clipboard') {
        const plainText = generatePlainText(view, data, timelineName, filterLabel, listStyle)
        const htmlText = generateHtml(view, data, timelineName, filterLabel, listStyle)
        setClientPending(true)
        copyToClipboard(plainText, htmlText)
          .then(flashDone)
          .catch(() => { /* clipboard may be denied */ })
          .finally(() => setClientPending(false))
        return
      }

      // markdown or plaintext — generate and download
      const isMarkdown = format.id === 'markdown'
      const content = isMarkdown
        ? generateMarkdown(view, data, timelineName, filterLabel, listStyle)
        : generatePlainText(view, data, timelineName, filterLabel, listStyle)
      const mimeType = isMarkdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8'
      const blob = new Blob([content], { type: mimeType })
      saveBlob(blob, buildExportFilename(timelineName, format.ext, view))
      flashDone()
      return
    }

    // Server-side: CSV / xlsx / ICS
    const isDataFormat = format.id === 'csv' || format.id === 'xlsx'
    void download(format.id, format.ext, {
      activityIds: scope === 'view' ? viewActivityIds : null,
      filter: scope === 'view' && !viewActivityIds ? filterDefinition : null,
      columns: isDataFormat ? listExportColumns : null,
    }).then(flashDone)
  }, [format, view, timelineName, teamName, filterLabel, periodLabel, textExportData, captureElement, presentationFrame, scope, listStyle, viewActivityIds, filterDefinition, listExportColumns, download, flashDone])

  const emptyView = filteredCount === 0
  const subWithFilter = filterLabel !== null
    ? `${filteredCount} of ${totalCount} activities · matches your filter`
    : `All ${totalCount} activities · nothing filtered out`

  // Button label / icon for the primary action
  const actionLabel = format.verb === 'copy'
    ? done ? 'Copied!' : (isPending ? 'Copying…' : 'Copy to clipboard')
    : format.verb === 'print'
    ? done ? 'Print dialog opened' : 'Print…'
    : done ? 'Downloaded' : (isPending ? 'Downloading…' : `Download ${format.ext}`)
  const ActionIcon = format.verb === 'copy' ? Copy : format.verb === 'print' ? Printer : Download

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[hsl(200_24%_11%/0.55)] p-6 backdrop-blur-[2px]">
      <div className="flex max-h-[88vh] w-[min(620px,100%)] flex-col overflow-hidden rounded-[var(--radius-xl)] bg-card shadow-[var(--shadow-lg)]">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 px-5 py-[18px]">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[hsl(188_59%_38%/0.12)] text-primary">
            <FileOutput size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[17px] font-bold leading-tight text-foreground">Export this view</h2>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm bg-secondary" />
              {timelineName ? `${timelineName} · ` : ''}{VIEW_LABELS[view]} view
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

        {/* Filter context strip */}
        <div className="shrink-0 border-b border-border px-5 pb-[14px]">
          <div className={cn(
            'rounded-[var(--radius-lg)] px-3 py-[9px]',
            emptyView ? 'bg-[color-mix(in_srgb,var(--warning)_13%,transparent)]' : 'bg-muted',
          )}>
            <div className="flex items-center gap-2 text-[12.5px]">
              {emptyView
                ? <AlertTriangle size={14} className="shrink-0 text-warning" strokeWidth={2} />
                : <Filter size={14} className="shrink-0 text-muted-foreground" strokeWidth={2} />}
              <span className="flex-1 text-foreground">
                {filterLabel !== null
                  ? <>Filtered: <span className="font-semibold">{filterLabel}</span></>
                  : `Exporting the ${VIEW_LABELS[view]} view as you see it`}
              </span>
              <span className={cn('shrink-0 text-[11.5px] font-semibold', emptyView ? 'text-warning' : 'text-muted-foreground')}>
                {filterLabel !== null ? `${filteredCount} of ${totalCount} activities` : `All ${totalCount} activities`}
              </span>
            </div>
            {emptyView && (
              <div className="ml-[22px] mt-1 text-[12px] text-muted-foreground">
                This view has no activities — the export will be empty or headers-only.
              </div>
            )}
          </div>
        </div>

        {/* Body — format rail + options pane */}
        <div className="flex flex-1 overflow-hidden">
          <div role="listbox" aria-label="Export format" className="flex w-[196px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2.5">
            {formats.map(f => {
              const FIcon = f.icon
              const selected = f.id === formatId
              // Badge icon: copy for clipboard, printer for printable view, download for everything else
              const BadgeIcon = f.verb === 'copy' ? Copy : f.verb === 'print' ? Printer : Download
              return (
                <button
                  key={f.id}
                  role="option"
                  aria-selected={selected}
                  onClick={() => selectFormat(f.id)}
                  className={cn(
                    'flex items-center gap-[9px] rounded-[var(--radius-md)] border-none px-[9px] py-2 text-left text-[13px] transition-colors',
                    selected ? 'bg-[hsl(188_59%_38%/0.1)] text-foreground font-semibold' : 'bg-transparent text-foreground hover:bg-muted',
                  )}
                >
                  <FIcon size={15} strokeWidth={selected ? 2.2 : 1.8} className={selected ? 'shrink-0 text-primary' : 'shrink-0 text-muted-foreground'} />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span title={f.verb === 'copy' ? 'Copy' : f.verb === 'print' ? 'Print' : 'Download'} className={cn('shrink-0 text-muted-foreground', selected ? 'opacity-90' : 'opacity-65')}>
                    <BadgeIcon size={11} strokeWidth={2} />
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
            {/* Format heading */}
            <div className="flex items-start gap-2.5">
              <Icon size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-[14px] font-bold text-foreground">{format.name}</div>
                <div className="mt-0.5 text-[12.5px] leading-[1.5] text-muted-foreground">{format.desc}</div>
              </div>
            </div>

            {/* Style picker — table vs outline, only for list view text formats */}
            {(format.id === 'markdown' || format.id === 'plaintext' || format.id === 'clipboard') && view === 'list' && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Style</div>
                <div className="flex overflow-hidden rounded-[var(--radius-lg)] border border-border">
                  <StyleOption
                    label="Table"
                    desc="Aligned columns"
                    selected={listStyle === 'table'}
                    onSelect={() => setListStyle('table')}
                  />
                  <div className="w-px shrink-0 bg-border" />
                  <StyleOption
                    label="Outline"
                    desc="Bullet list with fields"
                    selected={listStyle === 'outline'}
                    onSelect={() => setListStyle('outline')}
                  />
                </div>
              </div>
            )}

            {/* Scope picker — only for server-side data formats */}
            {format.scope && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Activities to export</div>
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
                  <ScopeRow
                    label="Current view"
                    sub={subWithFilter}
                    selected={scope === 'view'}
                    onSelect={() => setScope('view')}
                  />
                  <div className="border-t border-border" />
                  <ScopeRow
                    label="Entire timeline"
                    sub={`All ${totalCount} activities · ignores filters`}
                    selected={scope === 'all'}
                    onSelect={() => setScope('all')}
                  />
                </div>
              </div>
            )}

            {/* Filename chip — only for download formats */}
            {format.verb === 'download' && format.ext && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">File</div>
                <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-muted px-[11px] py-[7px] font-mono text-[12px] text-foreground">
                  <FileDown size={13} strokeWidth={2} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{buildExportFilename(timelineName, format.ext, filenameView)}</span>
                </div>
              </div>
            )}

            {/* Clipboard note */}
            {format.id === 'clipboard' && (
              <div className="rounded-[var(--radius-md)] bg-muted px-3 py-2.5 text-[12px] leading-[1.5] text-muted-foreground">
                Copies <strong className="text-foreground">rich text</strong> (HTML) + plain text — paste into Slack, Google Docs, or Word to get a formatted {view === 'list' && listStyle === 'outline' ? 'outline' : 'table'}.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-border px-5 py-[13px]">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAction} disabled={isPending} className="min-w-[168px] justify-center">
            {done
              ? <><Check size={14} strokeWidth={2.2} /> {actionLabel}</>
              : <><ActionIcon size={14} strokeWidth={2.2} /> {actionLabel}</>}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function StyleOption({ label, desc, selected, onSelect }: { label: string; desc: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-1 flex-col items-start px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-[hsl(188_59%_38%/0.09)]' : 'bg-transparent hover:bg-muted',
      )}
    >
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <span className="text-[11.5px] text-muted-foreground">{desc}</span>
    </button>
  )
}

function ScopeRow({ label, sub, selected, onSelect }: { label: string; sub: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-[hsl(188_59%_38%/0.09)]' : 'bg-transparent hover:bg-muted',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px]',
        selected ? 'border-[5px] border-primary' : 'border-input',
      )} />
      <span>
        <div className="text-[13px] font-semibold text-foreground">{label}</div>
        <div className="text-[11.5px] text-muted-foreground">{sub}</div>
      </span>
    </button>
  )
}
