/**
 * ImportMappingStep — the wizard's conditional map-columns step.
 *
 * One row per file column: the column header and a field dropdown (or
 * "Don't import"), unmapped columns sorted to the top. A field already
 * claimed by another column is disabled — two columns on one field is a
 * server-side file error, so the UI simply prevents it. The date-order
 * question renders here only when the file's numeric dates stayed ambiguous
 * column-wide (see importFields.hasAmbiguousDates).
 */

import { useState } from 'react'
import { IMPORT_FIELDS } from './importFields'

export interface ImportMappingStepProps {
  /** Effective mapping — file column → field name, '' = ignored. */
  mapping: Record<string, string>
  /** Called with the full updated mapping whenever one dropdown changes. */
  onMappingChange: (mapping: Record<string, string>) => void
  /** Whether to show the ambiguous-date-order question. */
  showDateOrder: boolean
  dateOrder: 'mdy' | 'dmy'
  onDateOrderChange: (order: 'mdy' | 'dmy') => void
}

export default function ImportMappingStep({
  mapping,
  onMappingChange,
  showDateOrder,
  dateOrder,
  onDateOrderChange,
}: ImportMappingStepProps) {
  // The server returns the mapping as a JSON object whose keys arrive in
  // alphabetical order (Go map marshaling), not file order. Sort unmapped
  // columns — the ones needing attention — to the top, and freeze the order
  // for this mount so rows don't jump around as the user assigns fields.
  const [columns] = useState(() =>
    Object.keys(mapping).sort((a, b) => {
      const rank = (c: string) => (mapping[c] === '' ? 0 : 1)
      return rank(a) - rank(b) || a.localeCompare(b)
    }),
  )
  const used = new Set(Object.values(mapping).filter(v => v !== ''))

  const handleChange = (column: string, field: string) => {
    onMappingChange({ ...mapping, [column]: field })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-[12.5px] leading-[1.5] text-muted-foreground">
        Match each file column to a draba field. Columns set to
        {' '}<span className="font-semibold text-foreground">Don't import</span> are skipped.
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border">
        {columns.map((column, i) => {
          const value = mapping[column]
          return (
            <div
              key={column}
              className={`flex items-center gap-3 px-3 py-2 ${i > 0 ? 'border-t border-border' : ''} ${value === '' ? 'bg-muted/50' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground" title={column}>
                {column}
              </span>
              <span className="shrink-0 text-[12px] text-muted-foreground">→</span>
              <select
                aria-label={`Field for column ${column}`}
                value={value}
                onChange={e => handleChange(column, e.target.value)}
                className="h-8 w-[180px] shrink-0 rounded-[var(--radius-md)] border border-input bg-background px-2 text-[13px] text-foreground"
              >
                <option value="">Don't import</option>
                {IMPORT_FIELDS.map(f => (
                  <option
                    key={f.value}
                    value={f.value}
                    disabled={used.has(f.value) && value !== f.value}
                  >
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {showDateOrder && (
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
            Date order
          </div>
          <div className="mb-2 text-[12.5px] leading-[1.5] text-muted-foreground">
            Dates like <span className="font-mono">3/5/26</span> are ambiguous in this file — which order are they in?
          </div>
          <div className="flex overflow-hidden rounded-[var(--radius-lg)] border border-border">
            <DateOrderOption
              label="Month / Day / Year"
              desc="3/5/26 = March 5, 2026"
              selected={dateOrder === 'mdy'}
              onSelect={() => onDateOrderChange('mdy')}
            />
            <div className="w-px shrink-0 bg-border" />
            <DateOrderOption
              label="Day / Month / Year"
              desc="3/5/26 = May 3, 2026"
              selected={dateOrder === 'dmy'}
              onSelect={() => onDateOrderChange('dmy')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function DateOrderOption({ label, desc, selected, onSelect }: {
  label: string
  desc: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-1 flex-col items-start px-3 py-2.5 text-left transition-colors ${selected ? 'bg-[hsl(188_59%_38%/0.09)]' : 'bg-transparent hover:bg-muted'}`}
    >
      <span className="text-[13px] font-semibold text-foreground">{label}</span>
      <span className="text-[11.5px] text-muted-foreground">{desc}</span>
    </button>
  )
}
