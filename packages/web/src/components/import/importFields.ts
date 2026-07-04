/**
 * Field vocabulary + result-shape helpers for the bulk-import wizard.
 *
 * The field names mirror the server's mapping contract (ImportOptions.mapping
 * accepts: title, start, end, description, status, assignees, tags, parent,
 * progress, location, url). The wizard drives its mapping dropdowns and its
 * conditional steps off these helpers rather than re-deriving server rules.
 */

import type { ImportResult } from '@/hooks/useImport'

export interface ImportField {
  value: string
  label: string
}

/** Every mappable draba field, in template column order. */
export const IMPORT_FIELDS: ImportField[] = [
  { value: 'title', label: 'Title' },
  { value: 'start', label: 'Start date' },
  { value: 'end', label: 'End date' },
  { value: 'description', label: 'Description' },
  { value: 'status', label: 'Status' },
  { value: 'assignees', label: 'Assignees' },
  { value: 'tags', label: 'Tags' },
  { value: 'parent', label: 'Parent' },
  { value: 'progress', label: 'Progress' },
  { value: 'location', label: 'Location' },
  { value: 'url', label: 'URL' },
]

/**
 * True when auto-mapping left file columns unmapped ("" in the mapping the
 * server actually used) — the signal to show the map-columns step instead of
 * skipping straight to preview.
 */
export function needsMappingStep(result: ImportResult): boolean {
  return Object.values(result.mapping).some(field => field === '')
}

// The server discloses an option-decided (not file-proven) date order with
// exactly these per-cell warning texts (importer/dates.go); their presence is
// the only signal that the file stayed ambiguous and the dateOrder option
// actually mattered.
const AMBIGUOUS_DATE_RE = / read as (month-day-year|day-month-year)$/

/** True when the file's numeric dates stayed ambiguous and dateOrder decided. */
export function hasAmbiguousDates(result: ImportResult): boolean {
  // `?? []` guards servers built before the 15.2 nil-slice fix, which marshal
  // an empty issue list as JSON null despite the schema's required array.
  return result.rows.some(row =>
    (row.issues ?? []).some(issue => AMBIGUOUS_DATE_RE.test(issue.message)),
  )
}

/** Rows the commit pass will write: ok + warning (errors are excluded). */
export function importableCount(result: ImportResult): number {
  return result.summary.ok + result.summary.warnings
}
