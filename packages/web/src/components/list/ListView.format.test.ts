import { describe, it, expect } from 'vitest'
import { formatActivityDate, formatTimestamp } from './ListView'

// ── formatActivityDate — UTC-pinned display for startAt / endAt ───────────────

describe('formatActivityDate', () => {
  it('null → em-dash', () => {
    expect(formatActivityDate(null)).toBe('—')
  })

  it('undefined → em-dash', () => {
    expect(formatActivityDate(undefined)).toBe('—')
  })

  it('invalid string → em-dash', () => {
    expect(formatActivityDate('not-a-date')).toBe('—')
  })

  it('midnight-UTC May 31 displays as May 31 (timezone-safe)', () => {
    // "2026-05-31T00:00:00Z" is the canonical form the API emits for all-day dates.
    // Without timeZone:'UTC', a UTC-6 viewer would see "May 30".
    const result = formatActivityDate('2026-05-31T00:00:00Z')
    expect(result).toContain('31')
    expect(result).not.toContain('30')
  })

  it('midnight-UTC Jan 1 displays as Jan 1 (not Dec 31)', () => {
    const result = formatActivityDate('2026-01-01T00:00:00Z')
    expect(result).toContain('1')
    expect(result).toContain('2026')
    // "Dec 31" would appear if local-time shift rolled back into the previous year/month
    expect(result).not.toContain('Dec')
  })
})

// ── formatTimestamp — local-time display for createdAt / updatedAt ────────────

describe('formatTimestamp', () => {
  it('null → em-dash', () => {
    expect(formatTimestamp(null)).toBe('—')
  })

  it('undefined → em-dash', () => {
    expect(formatTimestamp(undefined)).toBe('—')
  })

  it('invalid string → em-dash', () => {
    expect(formatTimestamp('not-a-date')).toBe('—')
  })

  it('valid ISO returns a non-empty string with the year', () => {
    // formatTimestamp uses local timezone, so the exact month/day varies by TZ;
    // we can at least assert the year appears and the result is non-empty.
    const result = formatTimestamp('2026-06-15T12:00:00Z')
    expect(result).not.toBe('—')
    expect(result).toContain('2026')
  })
})

// ── Distinction: same ISO string, different rendering paths ───────────────────
//
// formatActivityDate always pins to UTC; formatTimestamp uses local time.
// In UTC+0 both produce the same output, so we can't assert they differ here
// without controlling process.env.TZ. The tests above independently verify
// each function's contract — the key invariant is that midnight-UTC dates
// never shift in formatActivityDate regardless of the runner's timezone.
