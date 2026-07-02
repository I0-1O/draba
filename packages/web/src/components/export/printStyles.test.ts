/**
 * printStyles — assertions on the per-view `@media print` CSS strings
 * (Phase 14.4).
 *
 * jsdom has no print engine (`@media print` never matches and `@page` isn't
 * parsed), so these rules can't be exercised behaviorally here — browser
 * print preview is the /test-phase manual check. What CAN regress silently is
 * the content of the strings themselves: a lost `@page` orientation, a
 * broken-off base block, or a `[data-export-role]` selector that drifts from
 * the attribute the components actually render (the DOM side of that contract
 * is asserted in CleanSnapshot.test.tsx). These tests pin that content.
 */

import { describe, it, expect } from 'vitest'
import { GANTT_PRINT_CSS, LIST_PRINT_CSS, KANBAN_PRINT_CSS, CALENDAR_PRINT_CSS } from './printStyles'

const ALL = { GANTT_PRINT_CSS, LIST_PRINT_CSS, KANBAN_PRINT_CSS, CALENDAR_PRINT_CSS }

describe('printStyles', () => {
  it.each(Object.entries(ALL))('%s carries the shared print-only base block', (_name, css) => {
    // Hidden during normal layout / PNG rasterization…
    expect(css).toContain('.presentation-print-only { display: none; }')
    // …and revealed only under @media print.
    expect(css).toMatch(/@media print \{\s*\.presentation-print-only \{ display: block; \}/)
  })

  it('sets landscape orientation for Gantt, Kanban, and Calendar', () => {
    for (const css of [GANTT_PRINT_CSS, KANBAN_PRINT_CSS, CALENDAR_PRINT_CSS]) {
      expect(css).toContain('@page { size: landscape; margin: 10mm; }')
    }
  })

  it('keeps List portrait (no size override) with its own margin', () => {
    expect(LIST_PRINT_CSS).not.toContain('size: landscape')
    expect(LIST_PRINT_CSS).toContain('@page { margin: 14mm; }')
  })

  it('reveals the Gantt member-color legend as a flex row under print', () => {
    expect(GANTT_PRINT_CSS).toContain('.presentation-print-only.gantt-legend { display: flex; }')
  })

  it('keeps List rows unclipped and unbroken across pages', () => {
    expect(LIST_PRINT_CSS).toContain('[data-export-role="list-table-wrap"] { overflow: visible !important; }')
    expect(LIST_PRINT_CSS).toContain('[data-export-role="list-table-wrap"] tr { break-inside: avoid; }')
  })

  it('reflows the Kanban columns row and keeps each column on one page', () => {
    // Horizontal overflow doesn't paginate — the columns row must unclip and wrap.
    expect(KANBAN_PRINT_CSS).toMatch(/\[data-export-role="kanban-columns-row"\] \{[^}]*overflow: visible !important;/)
    expect(KANBAN_PRINT_CSS).toMatch(/\[data-export-role="kanban-columns-row"\] \{[^}]*flex-wrap: wrap !important;/)
    expect(KANBAN_PRINT_CSS).toMatch(/\[data-export-role="kanban-column"\] \{[^}]*break-inside: avoid;/)
  })
})
