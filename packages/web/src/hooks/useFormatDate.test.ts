import { describe, it, expect } from 'vitest'
import { formatDate } from './useFormatDate'

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  // January 5, 2026
  const d = new Date(2026, 0, 5)

  it('MM/DD/YYYY → zero-padded month/day/year', () => {
    expect(formatDate(d, 'MM/DD/YYYY')).toBe('01/05/2026')
  })

  it('DD/MM/YYYY → zero-padded day/month/year', () => {
    expect(formatDate(d, 'DD/MM/YYYY')).toBe('05/01/2026')
  })

  it('YYYY-MM-DD → ISO-style', () => {
    expect(formatDate(d, 'YYYY-MM-DD')).toBe('2026-01-05')
  })

  it('MMM D, YYYY (default) → English short month', () => {
    expect(formatDate(d, 'MMM D, YYYY')).toBe('Jan 5, 2026')
  })

  it('unknown format falls through to MMM D, YYYY default', () => {
    // Any unrecognised string uses the en-US toLocaleDateString fallback.
    expect(formatDate(d, 'unknown')).toBe('Jan 5, 2026')
  })

  it('December 31 — single-digit day does not get zero-padded in default format', () => {
    const dec31 = new Date(2026, 11, 31)
    expect(formatDate(dec31, 'MMM D, YYYY')).toBe('Dec 31, 2026')
  })
})
