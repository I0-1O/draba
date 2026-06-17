/**
 * exportCapabilities — unit tests for getExportFormats and buildExportFilename.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getExportFormats, buildExportFilename } from './exportCapabilities'

describe('getExportFormats', () => {
  it('returns only data formats (3) for gantt', () => {
    const formats = getExportFormats('gantt')
    expect(formats).toHaveLength(3)
    const ids = formats.map(f => f.id)
    expect(ids).toContain('csv')
    expect(ids).toContain('xlsx')
    expect(ids).toContain('ics')
    expect(ids).not.toContain('markdown')
    expect(ids).not.toContain('clipboard')
  })

  it('returns data + text formats (6) for list, kanban, calendar', () => {
    const views = ['list', 'kanban', 'calendar'] as const
    for (const view of views) {
      const formats = getExportFormats(view)
      expect(formats).toHaveLength(6)
      const ids = formats.map(f => f.id)
      expect(ids).toContain('csv')
      expect(ids).toContain('xlsx')
      expect(ids).toContain('ics')
      expect(ids).toContain('markdown')
      expect(ids).toContain('plaintext')
      expect(ids).toContain('clipboard')
    }
  })

  it('each descriptor has required fields', () => {
    const allFormats = getExportFormats('list') // superset — includes text formats
    for (const f of allFormats) {
      expect(f.id).toBeTruthy()
      expect(f.name).toBeTruthy()
      expect(f.desc).toBeTruthy()
      expect(typeof f.scope).toBe('boolean')
      expect(f.verb === 'download' || f.verb === 'copy').toBe(true)
      expect(typeof f.clientSide).toBe('boolean')
      // ext may be empty string for clipboard
      if (f.id !== 'clipboard') {
        expect(f.ext).toMatch(/^\.[a-z]+$/)
      }
    }
  })

  it('server-side formats have scope=true', () => {
    const formats = getExportFormats('list')
    const serverFormats = formats.filter(f => !f.clientSide)
    for (const f of serverFormats) {
      expect(f.scope).toBe(true)
    }
  })

  it('client-side formats have scope=false and clientSide=true', () => {
    const formats = getExportFormats('list')
    const textFormats = formats.filter(f => f.clientSide)
    expect(textFormats).toHaveLength(3)
    for (const f of textFormats) {
      expect(f.scope).toBe(false)
      expect(f.clientSide).toBe(true)
    }
  })

  it('clipboard format has copy verb; others have download', () => {
    const formats = getExportFormats('list')
    const clipboard = formats.find(f => f.id === 'clipboard')
    expect(clipboard?.verb).toBe('copy')
    const nonClipboard = formats.filter(f => f.id !== 'clipboard')
    for (const f of nonClipboard) {
      expect(f.verb).toBe('download')
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
