/**
 * Export format descriptors for the Export dialog (Phase 14).
 *
 * One dialog serves all views (Gantt/List/Kanban/Calendar); format
 * availability and per-format copy is driven by this descriptor array so a
 * future view or format is an addition here, not a dialog redesign
 * (docs/design/handoffs/export-modal).
 *
 * 14.1: CSV, Excel, ICS (server-side, all views).
 * 14.2: Markdown, Plain text, Copy to clipboard (client-side, List/Kanban/Calendar only).
 */

import {
  Table, FileSpreadsheet, CalendarPlus, FileText, AlignLeft, Copy,
  type LucideIcon,
} from 'lucide-react'

export type ExportFormatId = 'csv' | 'xlsx' | 'ics' | 'markdown' | 'plaintext' | 'clipboard'
export type ExportViewType = 'gantt' | 'list' | 'calendar' | 'kanban'

export interface ExportFormatDescriptor {
  id: ExportFormatId
  name: string
  icon: LucideIcon
  /** One-line description shown in the options pane. */
  desc: string
  /** File extension, including the leading dot. Used as the download filename suffix. */
  ext: string
  /** Data formats (CSV/Excel/ICS) show the "current view vs entire timeline" scope picker. */
  scope: boolean
  /**
   * Primary action verb.
   * 'download' → "Download <ext>" button.
   * 'copy'     → "Copy to clipboard" button with "Copied!" flash.
   */
  verb: 'download' | 'copy'
  /** True for formats generated client-side (no API call). */
  clientSide: boolean
}

/** Data/calendar formats — server-side, available in every view. */
const DATA_FORMATS: ExportFormatDescriptor[] = [
  {
    id: 'csv',
    name: 'CSV',
    icon: Table,
    ext: '.csv',
    scope: true,
    verb: 'download',
    clientSide: false,
    desc: 'A plain spreadsheet file — opens in Excel, Google Sheets, or Numbers.',
  },
  {
    id: 'xlsx',
    name: 'Excel',
    icon: FileSpreadsheet,
    ext: '.xlsx',
    scope: true,
    verb: 'download',
    clientSide: false,
    desc: 'A formatted workbook for Excel, Google Sheets, or Numbers.',
  },
  {
    id: 'ics',
    name: 'Calendar (.ics)',
    icon: CalendarPlus,
    ext: '.ics',
    scope: true,
    verb: 'download',
    clientSide: false,
    desc: 'An iCalendar file — import into Google Calendar, Outlook, or Apple Calendar.',
  },
]

/** Textual formats — client-side, not available on Gantt (no sensible flat text shape). */
const TEXT_FORMATS: ExportFormatDescriptor[] = [
  {
    id: 'markdown',
    name: 'Markdown',
    icon: FileText,
    ext: '.md',
    scope: false,
    verb: 'download',
    clientSide: true,
    desc: 'GitHub-flavored Markdown — paste into a README, Notion, or any Markdown editor.',
  },
  {
    id: 'plaintext',
    name: 'Plain text',
    icon: AlignLeft,
    ext: '.txt',
    scope: false,
    verb: 'download',
    clientSide: true,
    desc: 'Space-aligned plain text — works in any text editor or monospace environment.',
  },
  {
    id: 'clipboard',
    name: 'Copy to clipboard',
    icon: Copy,
    ext: '',
    scope: false,
    verb: 'copy',
    clientSide: true,
    desc: 'Copies both rich (HTML) and plain text so paste lands formatted in Slack, Word, or Google Docs.',
  },
]

/**
 * Returns the export formats available for a given view.
 * Gantt has no sensible flat text representation — only data/calendar formats.
 * List/Kanban/Calendar also expose the three textual formats (14.2).
 */
export function getExportFormats(view: ExportViewType): ExportFormatDescriptor[] {
  if (view === 'gantt') return DATA_FORMATS
  return [...DATA_FORMATS, ...TEXT_FORMATS]
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
