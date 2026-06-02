import { describe, it, expect } from 'vitest'
import { formatDragDate } from './GanttGrid'

// ── formatDragDate — UTC drag-preview tooltip label ───────────────────────────

describe('formatDragDate', () => {
  it('midnight-UTC May 31 shows "May 31" in the drag tooltip', () => {
    // Without timeZone:'UTC', a UTC-6 viewer would see "May 30" in the drag tooltip.
    const d = new Date('2026-05-31T00:00:00Z')
    const result = formatDragDate(d)
    expect(result).toContain('31')
    expect(result).not.toContain('30')
  })

  it('midnight-UTC Jan 1 shows Jan 1, not Dec 31', () => {
    const d = new Date('2026-01-01T00:00:00Z')
    const result = formatDragDate(d)
    expect(result).toContain('2026')
    expect(result).not.toContain('Dec')
  })

  it('output includes year', () => {
    const d = new Date('2026-06-15T00:00:00Z')
    expect(formatDragDate(d)).toContain('2026')
  })
})
