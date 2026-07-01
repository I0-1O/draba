/**
 * htmlExport — serializes the PresentationFrame's document to a standalone
 * `.html` file (Phase 14.4). Stylesheets are already inlined into the
 * frame's head (PresentationFrame clones them from the parent document on
 * mount), so the saved file renders correctly opened directly from disk —
 * literally "save the share as a file."
 */

import { buildPresentationHeaderElement, type PresentationHeaderInfo } from '@/components/export/presentationHeader'

/** Triggers the browser to save a Blob with the given filename. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Serializes the PresentationFrame's document (with a header inserted for the capture) and downloads it. */
export function saveFramePresentationHtml(iframe: HTMLIFrameElement, info: PresentationHeaderInfo, filename: string): void {
  const doc = iframe.contentDocument
  if (!doc) return

  const header = buildPresentationHeaderElement(doc, info)
  doc.body.insertBefore(header, doc.body.firstChild)
  const html = `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
  header.remove()

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveBlob(blob, filename)
}
