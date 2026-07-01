/**
 * printStyles — per-view `@media print` CSS injected into the PresentationFrame
 * document (Phase 14.4).
 *
 * These rules are inert outside of an actual print (or print-preview) pass —
 * `@media print` never matches during normal layout or `html-to-image`
 * rasterization — so it's safe to always mount them alongside a Clean*Snapshot
 * regardless of which export format the user eventually picks.
 *
 * The Clean*Snapshot components already render at full natural extent (no
 * scroll clipping — established by the 14.3 PNG capture, which reads the same
 * unconstrained DOM). The one exception is Kanban's horizontal-scrolling
 * columns row: horizontal overflow doesn't reflow across printed pages the
 * way vertical overflow does, so it would otherwise be clipped. `[data-export-
 * role]` attributes on the relevant containers (KanbanBoard, KanbanColumn,
 * PublicListTable) give these rules stable, low-risk hooks without threading
 * print-specific classes through components shared with the live, interactive
 * dashboard.
 */

const BASE_PRINT_CSS = `
  .presentation-print-only { display: none; }
  @media print {
    .presentation-print-only { display: block; }
  }
`

export const GANTT_PRINT_CSS = BASE_PRINT_CSS + `
  @media print {
    @page { size: landscape; margin: 10mm; }
    .presentation-print-only.gantt-legend { display: flex; }
  }
`

export const LIST_PRINT_CSS = BASE_PRINT_CSS + `
  @media print {
    @page { margin: 14mm; }
    [data-export-role="list-table-wrap"] { overflow: visible !important; }
    [data-export-role="list-table-wrap"] tr { break-inside: avoid; }
  }
`

export const KANBAN_PRINT_CSS = BASE_PRINT_CSS + `
  @media print {
    @page { size: landscape; margin: 10mm; }
    [data-export-role="kanban-columns-row"] {
      overflow: visible !important;
      flex-wrap: wrap !important;
      height: auto !important;
    }
    [data-export-role="kanban-column"] {
      break-inside: avoid;
      max-height: none !important;
    }
  }
`

export const CALENDAR_PRINT_CSS = BASE_PRINT_CSS + `
  @media print {
    @page { size: landscape; margin: 10mm; }
  }
`
