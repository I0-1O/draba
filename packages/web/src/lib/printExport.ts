/**
 * printExport — triggers the browser's native print dialog against the
 * PresentationFrame's isolated document (Phase 14.4).
 *
 * `iframe.contentWindow.print()` prints only that document — the frame's
 * own `<style media="print">` blocks (see printStyles.ts, injected by each
 * Clean*Snapshot) scope the pagination/layout rules, and the header strip
 * built here gives the printed page the same team/timeline/filter context
 * as the PNG and HTML exports.
 */

import { buildPresentationHeaderElement, type PresentationHeaderInfo } from '@/components/export/presentationHeader'

/** Prints the PresentationFrame's document; the header is inserted for the print pass and removed after. */
export function printPresentationFrame(iframe: HTMLIFrameElement, info: PresentationHeaderInfo): void {
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) return

  const header = buildPresentationHeaderElement(doc, info)
  doc.body.insertBefore(header, doc.body.firstChild)

  const cleanup = () => {
    header.remove()
    win.removeEventListener('afterprint', cleanup)
  }
  win.addEventListener('afterprint', cleanup)

  win.focus()
  win.print()
}
