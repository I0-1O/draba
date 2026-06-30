/**
 * pngExport — client-side PNG snapshot of the active view (Phase 14.3).
 *
 * Rasterizes a clean, chrome-less render of the view via html-to-image and
 * composites a header strip (team/timeline, generated-at, filter) above it.
 *
 * The capture target is the body of a `PresentationFrame` iframe — an isolated,
 * always-light document (see components/export/PresentationFrame.tsx). Because
 * that document is structurally light and the snapshot content is unconstrained
 * (no scroll containers), this module no longer toggles the page's theme or
 * unclamps scrollable descendants the way the live-DOM-rasterization approach
 * had to: the body's own scrollWidth/scrollHeight is already the full extent,
 * and there is no `.dark` class anywhere in scope to confuse CSS-variable
 * resolution.
 */

import { toCanvas } from 'html-to-image'

export interface PngHeaderInfo {
  timelineName: string
  teamName: string | null
  filterLabel: string | null
  /**
   * Optional period context shown leading the subtitle — used by the Calendar
   * export to name the month/week, since the toolbar (which carries that label
   * on screen) is excluded from the capture.
   */
  periodLabel?: string | null
}

const PIXEL_RATIO = 2
const HEADER_HEIGHT = 56
const HEADER_PADDING_X = 24

/** Draws the header strip (team/timeline, generated-at, filter) onto a new canvas above the captured view. */
function compositeHeader(viewCanvas: HTMLCanvasElement, info: PngHeaderInfo): HTMLCanvasElement {
  const headerPx = HEADER_HEIGHT * PIXEL_RATIO
  const out = document.createElement('canvas')
  out.width = viewCanvas.width
  out.height = viewCanvas.height + headerPx
  const ctx = out.getContext('2d')
  if (!ctx) return viewCanvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)

  const pad = HEADER_PADDING_X * PIXEL_RATIO
  const title = info.teamName ? `${info.teamName} · ${info.timelineName}` : info.timelineName
  ctx.fillStyle = '#101828'
  ctx.font = `600 ${15 * PIXEL_RATIO}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillText(title, pad, headerPx / 2 - 9 * PIXEL_RATIO)

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  // Period label (Calendar) leads the subtitle so the month/week is obvious;
  // generated-at and any active filter follow.
  const subParts = [
    info.periodLabel,
    `Generated ${generatedAt}`,
    info.filterLabel ? `Filter: ${info.filterLabel}` : null,
  ].filter(Boolean)
  const sub = subParts.join(' · ')
  ctx.fillStyle = '#667085'
  ctx.font = `400 ${12 * PIXEL_RATIO}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.fillText(sub, pad, headerPx / 2 + 11 * PIXEL_RATIO)

  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = PIXEL_RATIO
  ctx.beginPath()
  ctx.moveTo(0, headerPx)
  ctx.lineTo(out.width, headerPx)
  ctx.stroke()

  ctx.drawImage(viewCanvas, 0, headerPx)
  return out
}

/**
 * Captures `element` as a PNG Blob: full extent, 2x pixel density, header strip
 * composited above the view. `element` is expected to be the body of a
 * PresentationFrame iframe (already light, already full-extent).
 */
export async function capturePngSnapshot(element: HTMLElement, info: PngHeaderInfo): Promise<Blob> {
  const viewCanvas = await toCanvas(element, {
    pixelRatio: PIXEL_RATIO,
    backgroundColor: '#ffffff',
    width: element.scrollWidth,
    height: element.scrollHeight,
  })
  const finalCanvas = compositeHeader(viewCanvas, info)
  return await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('PNG export: canvas.toBlob returned null'))
    }, 'image/png')
  })
}
