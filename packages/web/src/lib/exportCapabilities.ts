/**
 * Export format descriptors for the Export dialog (Phase 14.1).
 *
 * One dialog serves all views (Gantt/List/Kanban/Calendar); format
 * availability and per-format copy is driven by this descriptor array so a
 * future view or format is an addition here, not a dialog redesign
 * (docs/design/handoffs/export-modal). 14.1 implements the three data/calendar
 * formats — Markdown, plain text, PNG, and printable view land in 14.2-14.4.
 */

import { Table, FileSpreadsheet, CalendarPlus, type LucideIcon } from 'lucide-react'

export type ExportFormatId = 'csv' | 'xlsx' | 'ics'
export type ExportViewType = 'gantt' | 'list' | 'calendar' | 'kanban'

export interface ExportFormatDescriptor {
  id: ExportFormatId
  name: string
  icon: LucideIcon
  /** One-line description shown in the options pane. */
  desc: string
  /** File extension, including the leading dot. */
  ext: string
  /** Data formats (CSV/Excel/ICS) show the "current view vs entire timeline" scope picker. */
  scope: boolean
}

/** All formats implemented in 14.1 — available in every view. */
export const EXPORT_FORMATS: ExportFormatDescriptor[] = [
  {
    id: 'csv',
    name: 'CSV',
    icon: Table,
    ext: '.csv',
    scope: true,
    desc: 'A plain spreadsheet file — opens in Excel, Google Sheets, or Numbers.',
  },
  {
    id: 'xlsx',
    name: 'Excel',
    icon: FileSpreadsheet,
    ext: '.xlsx',
    scope: true,
    desc: 'A formatted workbook for Excel, Google Sheets, or Numbers.',
  },
  {
    id: 'ics',
    name: 'Calendar (.ics)',
    icon: CalendarPlus,
    ext: '.ics',
    scope: true,
    desc: 'An iCalendar file — import into Google Calendar, Outlook, or Apple Calendar.',
  },
]

/** Returns the export formats available for a given view. All 14.1 formats apply to every view. */
export function getExportFormats(_view: ExportViewType): ExportFormatDescriptor[] {
  return EXPORT_FORMATS
}

/**
 * Builds the download filename for a format: `<timeline-slug>-<yyyy-mm-dd><ext>`.
 * Matches the filename chip shown in the export dialog's options pane.
 */
export function buildExportFilename(timelineName: string, ext: string): string {
  const slug = timelineName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const date = new Date().toISOString().slice(0, 10)
  return `${slug || 'timeline'}-${date}${ext}`
}
