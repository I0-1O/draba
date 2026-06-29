/**
 * textExport — generator-level tests for the Phase 14.2 textual export module.
 *
 * Covers the four correctness defects fixed on 2026-06-17 (docs/log.md): column
 * visibility, row order (sort happens upstream in DashboardPage; these generators
 * must preserve whatever order listDisplayRows arrives in), group-by section
 * rendering, and parent-child depth/indentation. Also covers Markdown/HTML
 * escaping, since both are clipboard-paste-target strings and a missed escape
 * is a real injection/corruption risk, not just cosmetic.
 */

import { describe, it, expect } from 'vitest'
import type { components } from '@draba/shared'
import {
  buildListMarkdown, buildListMarkdownOutline,
  buildListPlainText,
  buildListHtml, buildListHtmlOutline,
  buildKanbanMarkdown, buildKanbanPlainText, buildKanbanHtml,
  buildCalendarMarkdown, buildCalendarHtml,
  type TextExportData, type ListExportRow,
} from './textExport'

type ApiActivity = components['schemas']['Activity']

function act(id: string, opts: Partial<ApiActivity> = {}): ApiActivity {
  return {
    id,
    title: id,
    timelineId: 'tl1',
    startAt: '2026-01-01T00:00:00Z',
    endAt: '2026-01-02T00:00:00Z',
    allDay: false,
    createdBy: 'user1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    description: null,
    notes: null,
    icon: null,
    color: null,
    percentComplete: null,
    location: null,
    url: null,
    archivedAt: null,
    parentActivityId: null,
    assignedMemberIds: [],
    tagIds: [],
    statusId: null,
    ...opts,
  }
}

const emptyData: TextExportData = {
  activities: [],
  memberById: new Map(),
  statusById: new Map(),
  tagById: new Map(),
  activityTitleById: new Map(),
  kanbanColumns: null,
  listDisplayRows: null,
  listVisibleColumns: null,
  kanbanShowHierarchy: false,
  kanbanChildrenByParentId: new Map(),
}

function listRows(rows: ListExportRow[], overrides: Partial<TextExportData> = {}): TextExportData {
  return { ...emptyData, listDisplayRows: rows, ...overrides }
}

// ── Column visibility ──────────────────────────────────────────────────────────

describe('buildListMarkdown — column visibility', () => {
  it('emits only the requested columns, in the requested order', () => {
    const data = listRows(
      [{ kind: 'activity', activity: act('a1'), depth: 0 }],
      { listVisibleColumns: ['title', 'status'] },
    )
    const out = buildListMarkdown(data, 'Timeline', null)
    expect(out).toContain('| Title | Status |')
    expect(out).not.toContain('Assigned To')
    expect(out).not.toContain('Progress')
  })

  it('falls back to the default column set when listVisibleColumns is null', () => {
    const data = listRows([{ kind: 'activity', activity: act('a1'), depth: 0 }])
    const out = buildListMarkdown(data, 'Timeline', null)
    expect(out).toContain('Assigned To')
    expect(out).toContain('Progress')
  })
})

describe('buildListPlainText — column visibility', () => {
  it('renders only the requested columns', () => {
    const data = listRows(
      [{ kind: 'activity', activity: act('a1'), depth: 0 }],
      { listVisibleColumns: ['title'] },
    )
    const out = buildListPlainText(data, 'Timeline', null)
    const headerLine = out.split('\n').find(l => l.startsWith('Title'))
    expect(headerLine).toBeDefined()
    expect(headerLine).not.toContain('Status')
  })
})

// ── Row order (sort happens upstream; generators must not reorder) ────────────

describe('buildListMarkdown — row order', () => {
  it('preserves the order of listDisplayRows verbatim', () => {
    const data = listRows([
      { kind: 'activity', activity: act('zebra'), depth: 0 },
      { kind: 'activity', activity: act('apple'), depth: 0 },
    ])
    const out = buildListMarkdown(data, 'Timeline', null)
    const zebraIdx = out.indexOf('zebra')
    const appleIdx = out.indexOf('apple')
    expect(zebraIdx).toBeGreaterThan(-1)
    expect(zebraIdx).toBeLessThan(appleIdx)
  })
})

// ── Group-by sections ──────────────────────────────────────────────────────────

describe('buildListMarkdown — group-by', () => {
  it('emits a ## heading + fresh table per group', () => {
    const data = listRows([
      { kind: 'group', label: 'Alice', count: 1 },
      { kind: 'activity', activity: act('a1'), depth: 0 },
      { kind: 'group', label: 'Bob', count: 1 },
      { kind: 'activity', activity: act('a2'), depth: 0 },
    ])
    const out = buildListMarkdown(data, 'Timeline', null)
    expect(out).toContain('## Alice (1)')
    expect(out).toContain('## Bob (1)')
    // Each group gets its own header row, not just one shared table.
    expect(out.match(/\| Title \|/g)?.length).toBe(2)
  })
})

describe('buildListMarkdownOutline — group-by', () => {
  it('emits a ## heading per group with no shared table header', () => {
    const data = listRows([
      { kind: 'group', label: 'Alice', count: 1 },
      { kind: 'activity', activity: act('a1'), depth: 0 },
    ])
    const out = buildListMarkdownOutline(data, 'Timeline', null)
    expect(out).toContain('## Alice (1)')
    expect(out).toContain('a1')
  })
})

describe('buildKanbanMarkdown — section per column', () => {
  it('emits one heading per non-empty column', () => {
    const data: TextExportData = {
      ...emptyData,
      kanbanColumns: [
        { label: 'To Do', activities: [act('a1')] },
        { label: 'Done', activities: [] },
        { label: 'In Progress', activities: [act('a2')] },
      ],
    }
    const out = buildKanbanMarkdown(data, 'Timeline', null)
    expect(out).toContain('## To Do (1)')
    expect(out).toContain('## In Progress (1)')
    expect(out).not.toContain('## Done')
  })
})

describe('buildCalendarMarkdown — agenda grouping', () => {
  it('groups activities under a heading per start date, sorted chronologically', () => {
    const data: TextExportData = {
      ...emptyData,
      activities: [
        act('later', { startAt: '2026-02-01T00:00:00Z' }),
        act('earlier', { startAt: '2026-01-01T00:00:00Z' }),
      ],
    }
    const out = buildCalendarMarkdown(data, 'Timeline', null)
    expect(out.indexOf('earlier')).toBeLessThan(out.indexOf('later'))
  })
})

// ── Parent-child depth / indentation ───────────────────────────────────────────

describe('buildListMarkdown — hierarchy depth', () => {
  it('prefixes child titles with the depth marker in the title cell', () => {
    const data = listRows([
      { kind: 'activity', activity: act('parent'), depth: 0 },
      { kind: 'activity', activity: act('child'), depth: 1 },
    ])
    const out = buildListMarkdown(data, 'Timeline', null)
    expect(out).toContain('| parent |')
    expect(out).toContain('↳ child')
  })
})

describe('buildListMarkdownOutline — hierarchy depth', () => {
  it('indents nested bullets by depth', () => {
    const data = listRows([
      { kind: 'activity', activity: act('parent'), depth: 0 },
      { kind: 'activity', activity: act('child'), depth: 1 },
    ])
    const out = buildListMarkdownOutline(data, 'Timeline', null)
    const lines = out.split('\n')
    const childLine = lines.find(l => l.includes('child'))!
    expect(childLine.startsWith('  -')).toBe(true)
  })
})

describe('buildKanbanHtml — hierarchy nesting', () => {
  it('nests children in a sub-<ul> under their parent <li> when kanbanShowHierarchy is true', () => {
    const parent = act('parent')
    const child = act('child')
    const data: TextExportData = {
      ...emptyData,
      kanbanColumns: [{ label: 'To Do', activities: [parent] }],
      kanbanShowHierarchy: true,
      kanbanChildrenByParentId: new Map([['parent', [child]]]),
    }
    const out = buildKanbanHtml(data, 'Timeline', null)
    expect(out).toMatch(/<li[^>]*>parent.*<ul/s)
    expect(out).toContain('child')
  })

  it('does not nest children when kanbanShowHierarchy is false', () => {
    const parent = act('parent')
    const child = act('child')
    const data: TextExportData = {
      ...emptyData,
      kanbanColumns: [{ label: 'To Do', activities: [parent] }],
      kanbanShowHierarchy: false,
      kanbanChildrenByParentId: new Map([['parent', [child]]]),
    }
    const out = buildKanbanHtml(data, 'Timeline', null)
    expect(out).not.toContain('child')
  })
})

// ── Escaping ───────────────────────────────────────────────────────────────────

describe('Markdown escaping', () => {
  it('escapes pipe characters in table cells so they cannot break GFM table syntax', () => {
    const data = listRows([{ kind: 'activity', activity: act('a | b'), depth: 0 }])
    const out = buildListMarkdown(data, 'Timeline', null)
    expect(out).toContain('a \\| b')
  })

  it('escapes pipe characters in outline title and URL fields', () => {
    const data = listRows([
      { kind: 'activity', activity: act('a | b', { url: 'http://x?a=1|2' }), depth: 0 },
    ])
    const out = buildListMarkdownOutline(data, 'Timeline', null)
    expect(out).toContain('a \\| b')
    expect(out).toContain('URL: http://x?a=1\\|2')
  })
})

describe('HTML escaping (clipboard text/html flavor)', () => {
  it('escapes HTML-significant characters in table cell values', () => {
    const data = listRows([
      { kind: 'activity', activity: act('<img src=x onerror=alert(1)>'), depth: 0 },
    ])
    const out = buildListHtml(data, 'Timeline', null)
    expect(out).not.toContain('<img src=x onerror=alert(1)>')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('escapes HTML-significant characters in the outline URL field', () => {
    const data = listRows([
      { kind: 'activity', activity: act('a', { url: '<script>alert(1)</script>' }), depth: 0 },
    ])
    const out = buildListHtmlOutline(data, 'Timeline', null)
    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).toContain('&lt;script&gt;')
  })

  it('repeats an escaped header row (not a raw <thead>) for each group section', () => {
    const data = listRows([
      { kind: 'group', label: 'Alice', count: 1 },
      { kind: 'activity', activity: act('a1'), depth: 0 },
    ])
    const out = buildListHtml(data, 'Timeline', null)
    // One <thead> for the table itself, plus one bare repeated header <tr> for the group.
    expect(out.match(/<thead>/g)?.length).toBe(1)
    expect(out.match(/<th style/g)!.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Empty states ───────────────────────────────────────────────────────────────

describe('empty states', () => {
  it('buildListMarkdown renders a header-only table with a no-activities note', () => {
    const out = buildListMarkdown(listRows([]), 'Timeline', null)
    expect(out).toContain('_No activities._')
  })

  it('buildKanbanPlainText renders "No activities." when every column is empty', () => {
    const data: TextExportData = { ...emptyData, kanbanColumns: [{ label: 'To Do', activities: [] }] }
    expect(buildKanbanPlainText(data, 'Timeline', null)).toContain('No activities.')
  })

  it('buildCalendarHtml renders an empty-state paragraph when there are no activities', () => {
    expect(buildCalendarHtml(emptyData, 'Timeline', null)).toContain('No activities.')
  })
})
