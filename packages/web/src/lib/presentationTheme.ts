/**
 * presentationTheme — the single "force light" definition shared by every
 * read-only presentation surface (Phase 14.4 collapses two independent
 * implementations into this one module): ShareViewPage's live-document
 * toggle (via `hooks/useForceLightDocument`) and PresentationFrame's
 * structural iframe light.
 * Both need the same operation — strip `.dark` from a document's root — so
 * it lives here once instead of being reimplemented per call site.
 */

/** Background color every presentation surface (PNG header, print, HTML save) renders against. */
export const PRESENTATION_BACKGROUND = '#ffffff'
export const PRESENTATION_FOREGROUND = '#101828'
export const PRESENTATION_MUTED = '#667085'
export const PRESENTATION_BORDER = '#e5e7eb'

/**
 * Removes the `dark` class from a document's root element.
 * Returns whether it was present, so a caller managing the *live* document
 * (as opposed to an isolated iframe that never had it) can restore it on
 * cleanup.
 */
export function forceLightDocumentElement(doc: Document): boolean {
  const root = doc.documentElement
  const hadDark = root.classList.contains('dark')
  root.classList.remove('dark')
  return hadDark
}
