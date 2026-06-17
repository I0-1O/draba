/**
 * exportCapabilities — unit tests for getExportFormats and buildExportFilename.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getExportFormats, buildExportFilename, EXPORT_FORMATS } from './exportCapabilities'

describe('getExportFormats', () => {
  it('returns all three formats for every view type', () => {
    const views = ['gantt', 'list', 'kanban', 'calendar'] as const
    for (const view of views) {
      const formats = getExportFormats(view)
      expect(formats).toHaveLength(3)
      const ids = formats.map(f => f.id)
      expect(ids).toContain('csv')
      expect(ids).toContain('xlsx')
      expect(ids).toContain('ics')
    }
  })

  it('returns the EXPORT_FORMATS reference unchanged', () => {
    expect(getExportFormats('gantt')).toBe(EXPORT_FORMATS)
  })

  it('each descriptor has required fields', () => {
    for (const f of EXPORT_FORMATS) {
      expect(f.id).toBeTruthy()
      expect(f.name).toBeTruthy()
      expect(f.desc).toBeTruthy()
      expect(f.ext).toMatch(/^\.[a-z]+$/)
      expect(typeof f.scope).toBe('boolean')
    }
  })
})

describe('buildExportFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-16T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('slugifies the name and appends the date and extension', () => {
    expect(buildExportFilename('Sales Kick-Off 2026', '.csv')).toBe('sales-kick-off-2026-2026-06-16.csv')
  })

  it('strips uppercase and special characters', () => {
    expect(buildExportFilename('My "Timeline"!', '.xlsx')).toBe('my-timeline-2026-06-16.xlsx')
  })

  it('falls back to "timeline" when the name is empty or all punctuation', () => {
    expect(buildExportFilename('', '.csv')).toBe('timeline-2026-06-16.csv')
    expect(buildExportFilename('---', '.ics')).toBe('timeline-2026-06-16.ics')
  })

  it('preserves numbers and hyphens in the slug', () => {
    expect(buildExportFilename('Q1 2026', '.csv')).toBe('q1-2026-2026-06-16.csv')
  })
})
