/**
 * exportCapabilities — unit tests for getExportFormats and buildExportFilename.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getExportFormats, buildExportFilename } from './exportCapabilities'

describe('getExportFormats', () => {
  it('returns data formats + PNG + printable/HTML (6) for gantt', () => {
    const formats = getExportFormats('gantt')
    expect(formats).toHaveLength(6)
    const ids = formats.map(f => f.id)
    expect(ids).toContain('csv')
    expect(ids).toContain('xlsx')
    expect(ids).toContain('ics')
    expect(ids).toContain('png')
    expect(ids).toContain('printable')
    expect(ids).toContain('html')
    expect(ids).not.toContain('markdown')
    expect(ids).not.toContain('clipboard')
  })

  it('returns data + PNG + printable/HTML + text formats (9) for list, kanban, calendar', () => {
    const views = ['list', 'kanban', 'calendar'] as const
    for (const view of views) {
      const formats = getExportFormats(view)
      expect(formats).toHaveLength(9)
      const ids = formats.map(f => f.id)
      expect(ids).toContain('csv')
      expect(ids).toContain('xlsx')
      expect(ids).toContain('ics')
      expect(ids).toContain('png')
      expect(ids).toContain('printable')
      expect(ids).toContain('html')
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
      expect(['download', 'copy', 'print']).toContain(f.verb)
      expect(typeof f.clientSide).toBe('boolean')
      // ext may be empty string for clipboard/printable
      if (f.id !== 'clipboard' && f.id !== 'printable') {
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
    const clientFormats = formats.filter(f => f.clientSide)
    expect(clientFormats).toHaveLength(6) // png + printable + html + markdown + plaintext + clipboard
    for (const f of clientFormats) {
      expect(f.scope).toBe(false)
      expect(f.clientSide).toBe(true)
    }
  })

  it('clipboard has copy verb, printable has print verb, others have download', () => {
    const formats = getExportFormats('list')
    const clipboard = formats.find(f => f.id === 'clipboard')
    expect(clipboard?.verb).toBe('copy')
    const printable = formats.find(f => f.id === 'printable')
    expect(printable?.verb).toBe('print')
    const rest = formats.filter(f => f.id !== 'clipboard' && f.id !== 'printable')
    for (const f of rest) {
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

  it('inserts the view segment when a view is given', () => {
    expect(buildExportFilename('Sales Kick-Off', '.png', 'kanban')).toBe('sales-kick-off-kanban-2026-06-16.png')
  })

  it('omits the view segment when no view is given', () => {
    expect(buildExportFilename('Sales Kick-Off', '.png')).toBe('sales-kick-off-2026-06-16.png')
  })
})
