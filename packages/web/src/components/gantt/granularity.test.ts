import { describe, it, expect } from 'vitest'
import { generateColumns, positionInColumns, snapDivisorFor } from './granularity'

// ── generateColumns — weekStart option ───────────────────────────────────────
//
// Jan 2026 layout:
//   Mon Jan  5 (ISO week start)
//   Sun Jan  4 (Sunday week start)
//
// Jan 1 2026 is a Thursday.
//
// Input dates use Date.UTC to produce stable UTC-midnight values that give the
// same result regardless of the test runner's local timezone.

const JAN1  = new Date(Date.UTC(2026, 0, 1))  // Thu
const JAN31 = new Date(Date.UTC(2026, 0, 31)) // Sat

describe('generateColumns — weekStart', () => {
  it('monday week start: first week column begins on Monday Dec 29', () => {
    const cols = generateColumns(JAN1, JAN31, 'week', { weekStart: 'monday' })
    // Jan 1 is Thursday; Monday ISO week start = Dec 29 2025
    expect(cols[0].start.getUTCDay()).toBe(1) // 1 = Monday
    expect(cols[0].start.getUTCDate()).toBe(29)
  })

  it('sunday week start: first week column begins on Sunday Dec 28', () => {
    const cols = generateColumns(JAN1, JAN31, 'week', { weekStart: 'sunday' })
    // Jan 1 is Thursday; Sunday week start = Dec 28 2025
    expect(cols[0].start.getUTCDay()).toBe(0) // 0 = Sunday
    expect(cols[0].start.getUTCDate()).toBe(28)
  })

  it('default (no option) behaves like monday', () => {
    const defaultCols = generateColumns(JAN1, JAN31, 'week')
    const mondayCols  = generateColumns(JAN1, JAN31, 'week', { weekStart: 'monday' })
    expect(defaultCols[0].start.getTime()).toBe(mondayCols[0].start.getTime())
  })
})

// ── generateColumns — locale option ──────────────────────────────────────────

describe('generateColumns — locale', () => {
  it('en-US: month column label contains English month name', () => {
    const cols = generateColumns(JAN1, JAN31, 'month', { locale: 'en-US' })
    expect(cols[0].label).toMatch(/Jan/)
  })

  it('en-GB: day column label shows day-first ordering (e.g. "1 Jan")', () => {
    const cols = generateColumns(JAN1, JAN31, 'day', { locale: 'en-GB' })
    // en-GB {month:'short', day:'numeric', timeZone:'UTC'} → "1 Jan"
    expect(cols[0].label).toMatch(/Jan/)
    // The day should come first in en-GB
    expect(cols[0].label).toMatch(/^1/)
  })

  it('default locale behaves like en-US', () => {
    const defaultCols = generateColumns(JAN1, JAN31, 'month')
    const usCols      = generateColumns(JAN1, JAN31, 'month', { locale: 'en-US' })
    expect(defaultCols[0].label).toBe(usCols[0].label)
  })
})

// ── snapDivisorFor ────────────────────────────────────────────────────────────

describe('snapDivisorFor', () => {
  it('week → 7 (snap to day within week)', () => {
    expect(snapDivisorFor('week')).toBe(7)
  })

  it('month → 4 (snap to week within month)', () => {
    expect(snapDivisorFor('month')).toBe(4)
  })

  it('quarter → 3 (snap to month within quarter)', () => {
    expect(snapDivisorFor('quarter')).toBe(3)
  })

  it('year → 4 (snap to quarter within year)', () => {
    expect(snapDivisorFor('year')).toBe(4)
  })

  it('day → 1 (no finer snap at day granularity)', () => {
    expect(snapDivisorFor('day')).toBe(1)
  })

  it('auto → 1 (no finer snap for auto)', () => {
    expect(snapDivisorFor('auto')).toBe(1)
  })
})

// ── Timezone-safety: midnight-UTC dates ───────────────────────────────────────
//
// An activity stored as "2026-05-31T00:00:00Z" must display as May 31 and
// land in the May 31 column regardless of local timezone.  This suite uses
// Date.UTC inputs to reproduce the condition that would cause a regression
// when TZ=America/Denver (UTC-6).

describe('positionInColumns — midnight-UTC activity dates land on correct day', () => {
  // May 2026: generate day-granularity columns for the whole month
  const MAY1  = new Date(Date.UTC(2026, 4,  1))
  const MAY31 = new Date(Date.UTC(2026, 4, 31))
  const cols  = generateColumns(MAY1, MAY31, 'day')

  it('May 31 column label is "May 31"', () => {
    const mayThirtyFirst = cols.find(c => c.start.getUTCDate() === 31 && c.start.getUTCMonth() === 4)
    expect(mayThirtyFirst?.label).toMatch(/31/)
  })

  it('activity on 2026-05-31 lands in May 31 column (startCol ≥ 30)', () => {
    // "2026-05-31T00:00:00Z" — midnight UTC; same value the API emits
    const actStart = new Date('2026-05-31T00:00:00Z')
    const actEnd   = new Date('2026-05-31T00:00:00Z')
    const { startCol } = positionInColumns(actStart, actEnd, cols)
    // May 31 is the 31st day (0-indexed = 30)
    expect(Math.floor(startCol)).toBe(30)
  })

  it('activity on 2026-05-01 lands in May 1 column (startCol = 0)', () => {
    const actStart = new Date('2026-05-01T00:00:00Z')
    const actEnd   = new Date('2026-05-01T00:00:00Z')
    const { startCol } = positionInColumns(actStart, actEnd, cols)
    expect(Math.floor(startCol)).toBe(0)
  })

  it('formatLabel for May 31 day column shows "May 31" (UTC read-out)', () => {
    const mayThirtyFirst = cols.find(c => c.start.getUTCDate() === 31 && c.start.getUTCMonth() === 4)
    expect(mayThirtyFirst).toBeDefined()
    // Label must show May 31, not May 30 (which would happen with local-time formatting in UTC-6)
    expect(mayThirtyFirst!.label).toContain('31')
    expect(mayThirtyFirst!.label).not.toContain('30')
  })
})
