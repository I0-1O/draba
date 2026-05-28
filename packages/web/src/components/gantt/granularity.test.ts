import { describe, it, expect } from 'vitest'
import { generateColumns } from './granularity'

// ── generateColumns — weekStart option ───────────────────────────────────────

// Jan 2026 layout:
//   Mon Jan  5 (ISO week start)
//   Sun Jan  4 (Sunday week start)
//
// Jan 1 2026 is a Thursday.

const JAN1 = new Date(2026, 0, 1)   // Thu
const JAN31 = new Date(2026, 0, 31) // Sat

describe('generateColumns — weekStart', () => {
  it('monday week start: first week column begins on Monday Dec 29', () => {
    const cols = generateColumns(JAN1, JAN31, 'week', { weekStart: 'monday' })
    // Jan 1 is Thursday; Monday ISO week start = Dec 29 2025
    expect(cols[0].start.getDay()).toBe(1) // 1 = Monday
    expect(cols[0].start.getDate()).toBe(29)
  })

  it('sunday week start: first week column begins on Sunday Dec 28', () => {
    const cols = generateColumns(JAN1, JAN31, 'week', { weekStart: 'sunday' })
    // Jan 1 is Thursday; Sunday week start = Dec 28 2025
    expect(cols[0].start.getDay()).toBe(0) // 0 = Sunday
    expect(cols[0].start.getDate()).toBe(28)
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
    // en-GB {month:'short', day:'numeric'} → "1 Jan"
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
