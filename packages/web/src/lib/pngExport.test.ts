/**
 * pngExport — unit tests for capturePngSnapshot's surrounding logic.
 *
 * Since the 14.3 rework, the capture target is the body of an isolated,
 * always-light PresentationFrame iframe, so this module no longer toggles the
 * page theme or unclamps scroll containers — it simply rasterizes the element
 * at its full scroll extent and composites the header strip. `html-to-image`'s
 * toCanvas is module-mocked since jsdom has no real layout/canvas engine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { capturePngSnapshot } from './pngExport'

const mockToCanvas = vi.fn()
vi.mock('html-to-image', () => ({
  toCanvas: (...args: unknown[]) => mockToCanvas(...args),
}))

/** A minimal stand-in for an HTMLCanvasElement sufficient for compositeHeader + toBlob. */
function makeFakeCanvas(width = 100, height = 100) {
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
  }
  return {
    width,
    height,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['fake'], { type: 'image/png' }))),
  } as unknown as HTMLCanvasElement
}

beforeEach(() => {
  mockToCanvas.mockReset()
  mockToCanvas.mockResolvedValue(makeFakeCanvas())
  // document.createElement('canvas') is used internally for the header composite;
  // intercept only that tag so the rest of jsdom's DOM behaves normally.
  const realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (makeFakeCanvas() as unknown as HTMLElement) : realCreateElement(tag))
})

afterEach(() => {
  vi.restoreAllMocks()
  document.documentElement.classList.remove('dark')
})

describe('capturePngSnapshot', () => {
  it('resolves a Blob and calls toCanvas with the element, 2x pixel ratio, and white background', async () => {
    const el = document.createElement('div')
    const blob = await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: 'Acme', filterLabel: null })
    expect(blob).toBeInstanceOf(Blob)
    expect(mockToCanvas).toHaveBeenCalledWith(
      el,
      expect.objectContaining({ pixelRatio: 2, backgroundColor: '#ffffff' }),
    )
  })

  it('captures the element at its full scroll extent', async () => {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollWidth', { value: 1280, configurable: true })
    Object.defineProperty(el, 'scrollHeight', { value: 720, configurable: true })

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })

    expect(mockToCanvas).toHaveBeenCalledWith(el, expect.objectContaining({ width: 1280, height: 720 }))
  })

  it('does not touch the page theme (the capture target is its own light document)', async () => {
    document.documentElement.classList.add('dark')
    const el = document.createElement('div')

    let darkDuringCapture: boolean | undefined
    mockToCanvas.mockImplementation(() => {
      darkDuringCapture = document.documentElement.classList.contains('dark')
      return Promise.resolve(makeFakeCanvas())
    })

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })

    // The live page stays dark throughout — no flicker.
    expect(darkDuringCapture).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('renders the period label into the header strip when given', async () => {
    const el = document.createElement('div')
    const headerCanvas = makeFakeCanvas()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (headerCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null, periodLabel: 'June 2026' })

    const ctx = (headerCanvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> })
    const drawnText = ctx.fillText.mock.calls.map(c => c[0] as string)
    expect(drawnText.some(t => t.includes('June 2026'))).toBe(true)
  })

  it('orders the subtitle as period, then generated-at, then filter, joined with " · "', async () => {
    const el = document.createElement('div')
    const headerCanvas = makeFakeCanvas()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (headerCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await capturePngSnapshot(el, {
      timelineName: 'Q1 Plan', teamName: null, filterLabel: 'Open only', periodLabel: 'June 2026',
    })

    const ctx = (headerCanvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> })
    const subtitle = ctx.fillText.mock.calls.map(c => c[0] as string).find(t => t.includes('Generated'))
    expect(subtitle).toBeDefined()
    const periodIdx = subtitle!.indexOf('June 2026')
    const generatedIdx = subtitle!.indexOf('Generated')
    const filterIdx = subtitle!.indexOf('Filter: Open only')
    expect(periodIdx).toBeGreaterThanOrEqual(0)
    expect(periodIdx).toBeLessThan(generatedIdx)
    expect(generatedIdx).toBeLessThan(filterIdx)
  })

  it('omits the period and filter segments from the subtitle when absent', async () => {
    const el = document.createElement('div')
    const headerCanvas = makeFakeCanvas()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (headerCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })

    const ctx = (headerCanvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> })
    const subtitle = ctx.fillText.mock.calls.map(c => c[0] as string).find(t => t.includes('Generated'))
    expect(subtitle).toBeDefined()
    expect(subtitle).not.toContain('Filter:')
    expect(subtitle!.startsWith('Generated')).toBe(true)
  })

  it('prefixes the title with the team name when given, and omits it when absent', async () => {
    const el = document.createElement('div')
    const headerCanvas = makeFakeCanvas()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (headerCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: 'Acme', filterLabel: null })

    const ctx = (headerCanvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> })
    const titles = ctx.fillText.mock.calls.map(c => c[0] as string)
    expect(titles).toContain('Acme · Q1 Plan')
  })

  it('sizes the composited canvas to the header height plus the captured view height, at 2x density', async () => {
    const el = document.createElement('div')
    const viewCanvas = makeFakeCanvas(1280, 720)
    mockToCanvas.mockResolvedValueOnce(viewCanvas)
    const headerCanvas = makeFakeCanvas()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (headerCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })

    // HEADER_HEIGHT (56) * PIXEL_RATIO (2) = 112px added above the view's own height.
    expect(headerCanvas.width).toBe(1280)
    expect(headerCanvas.height).toBe(720 + 112)
    const ctx = (headerCanvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> })
    expect(ctx.drawImage).toHaveBeenCalledWith(viewCanvas, 0, 112)
  })

  it('propagates a toCanvas rejection', async () => {
    mockToCanvas.mockRejectedValueOnce(new Error('rasterization failed'))
    const el = document.createElement('div')

    await expect(capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null }))
      .rejects.toThrow('rasterization failed')
  })

  it('rejects when canvas.toBlob yields null', async () => {
    const el = document.createElement('div')
    const nullBlobCanvas = makeFakeCanvas()
    ;(nullBlobCanvas.toBlob as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (b: Blob | null) => void) => cb(null),
    )
    // The header composite creates the final canvas via document.createElement('canvas').
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
      tag === 'canvas' ? (nullBlobCanvas as unknown as HTMLElement) : realCreateElement(tag))

    await expect(capturePngSnapshot(el, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null }))
      .rejects.toThrow('canvas.toBlob returned null')
  })
})
