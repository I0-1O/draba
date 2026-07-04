/**
 * ImportPreviewStep — the wizard's mandatory preview: the disclosure surface
 * for every interpretation the parser made.
 *
 * Renders the summary strip ("42 ready · 5 with warnings · 3 errors"), the
 * file-level issues, the "Create N missing tags" opt-in (re-runs the dry-run
 * upstream), All/Warnings/Errors filter chips, and the row table with source
 * line numbers, status icons, resolved fields, and expandable per-cell
 * messages.
 */

import { useState } from 'react'
import { Check, AlertTriangle, XCircle, ChevronRight, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImportResult, ImportRowResult } from '@/hooks/useImport'

export type RowFilter = 'all' | 'warnings' | 'errors'

export interface ImportPreviewStepProps {
  result: ImportResult
  createMissingTags: boolean
  /** Toggling re-runs the dry-run with the new option. */
  onCreateMissingTagsChange: (create: boolean) => void
  /** True while a dry-run re-run is in flight (mapping/tag option changed). */
  revalidating: boolean
}

const STATUS_ICON = {
  ok: { Icon: Check, className: 'text-success' },
  warning: { Icon: AlertTriangle, className: 'text-warning' },
  error: { Icon: XCircle, className: 'text-destructive' },
} as const

export default function ImportPreviewStep({
  result,
  createMissingTags,
  onCreateMissingTagsChange,
  revalidating,
}: ImportPreviewStepProps) {
  const [filter, setFilter] = useState<RowFilter>('all')
  const { summary, rows, unknownNames } = result
  // Servers built before the 15.2 nil-slice fix marshal an empty issue list
  // as JSON null despite the schema's required array — guard rather than crash.
  const fileIssues = result.fileIssues ?? []

  const visibleRows = rows.filter(r =>
    filter === 'all' ? true : filter === 'warnings' ? r.status === 'warning' : r.status === 'error',
  )

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', revalidating && 'pointer-events-none opacity-60')}>
      {/* Summary strip */}
      <div className="shrink-0 rounded-[var(--radius-lg)] bg-muted px-3 py-[9px] text-[12.5px] text-foreground">
        <span className="font-semibold">{summary.ok} ready</span>
        {' · '}
        <span className={summary.warnings > 0 ? 'font-semibold text-warning' : ''}>{summary.warnings} with warnings</span>
        {' · '}
        <span className={summary.errors > 0 ? 'font-semibold text-destructive' : ''}>{summary.errors} errors</span>
        {summary.errors > 0 && <span className="text-muted-foreground"> — errors won't be imported</span>}
      </div>

      {/* File-level issues (encoding fallback, ignored sheets/columns) */}
      {fileIssues.length > 0 && (
        <div className="shrink-0 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2">
          {fileIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 py-0.5 text-[12px] text-foreground">
              <Info size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-warning" />
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {/* Missing-tags opt-in */}
      {unknownNames.tags.length > 0 && (
        <label className="flex shrink-0 cursor-pointer items-start gap-2 rounded-[var(--radius-md)] border border-border px-3 py-2 text-[12.5px]">
          <input
            type="checkbox"
            checked={createMissingTags}
            onChange={e => onCreateMissingTagsChange(e.target.checked)}
            className="mt-0.5 accent-[var(--primary)]"
          />
          <span className="text-foreground">
            Create {unknownNames.tags.length} missing {unknownNames.tags.length === 1 ? 'tag' : 'tags'}:{' '}
            <span className="text-muted-foreground">{unknownNames.tags.join(', ')}</span>
          </span>
        </label>
      )}

      {/* Filter chips */}
      <div role="tablist" aria-label="Row filter" className="flex shrink-0 gap-1.5">
        <FilterChip label={`All (${summary.total})`} selected={filter === 'all'} onSelect={() => setFilter('all')} />
        <FilterChip label={`Warnings (${summary.warnings})`} selected={filter === 'warnings'} onSelect={() => setFilter('warnings')} />
        <FilterChip label={`Errors (${summary.errors})`} selected={filter === 'errors'} onSelect={() => setFilter('errors')} />
      </div>

      {/* Row table */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-[var(--radius-lg)] border border-border">
        {visibleRows.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">
            No rows match this filter.
          </div>
        ) : (
          visibleRows.map(row => <PreviewRow key={row.line} row={row} />)
        )}
      </div>
    </div>
  )
}

function FilterChip({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        'rounded-full border px-3 py-1 text-[12px] transition-colors',
        selected
          ? 'border-primary bg-[hsl(188_59%_38%/0.1)] font-semibold text-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

function PreviewRow({ row }: { row: ImportRowResult }) {
  // Rows with issues start collapsed; the chevron discloses the messages.
  const [expanded, setExpanded] = useState(false)
  const { Icon, className } = STATUS_ICON[row.status]
  const a = row.activity
  // Same pre-fix-server guard as fileIssues above.
  const issues = row.issues ?? []
  const hasIssues = issues.length > 0

  const dateRange = a?.start
    ? a.end && a.end !== a.start ? `${a.start} → ${a.end}` : a.start
    : ''
  const extras = [
    a?.status,
    a?.assignees?.length ? a.assignees.join(', ') : null,
    a?.tags?.length ? a.tags.map(t => `#${t}`).join(' ') : null,
    a?.parent ? `↳ ${a.parent}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => hasIssues && setExpanded(e => !e)}
        aria-expanded={hasIssues ? expanded : undefined}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          hasIssues ? 'cursor-pointer hover:bg-muted' : 'cursor-default',
        )}
      >
        <span className="w-9 shrink-0 font-mono text-[11px] text-muted-foreground" title="Source line">
          {row.line}
        </span>
        <Icon size={14} strokeWidth={2.2} className={cn('shrink-0', className)} aria-label={row.status} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
          {a?.title || <span className="italic text-muted-foreground">(no title)</span>}
        </span>
        {dateRange && <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{dateRange}</span>}
        {extras && <span className="hidden max-w-[220px] shrink-0 truncate text-[11.5px] text-muted-foreground sm:inline">{extras}</span>}
        {hasIssues && (
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')}
          />
        )}
      </button>
      {expanded && hasIssues && (
        <div className="bg-muted/50 px-3 pb-2 pl-[60px]">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 py-1 text-[12px]">
              {issue.level === 'error'
                ? <XCircle size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-destructive" />
                : <AlertTriangle size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-warning" />}
              <span className="text-foreground">
                {issue.field && <span className="font-semibold">{issue.field}: </span>}
                {issue.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
