/**
 * PresentationFrame — an isolated, always-light document used as the shared
 * render surface for the visual exports (Phase 14.3 PNG; Phase 14.4 HTML/print).
 *
 * The earlier 14.3 approach mounted the clean snapshot inside the live dashboard
 * and forced light mode by toggling the `dark` class on the page's own `<html>`.
 * That repainted the visible dashboard (the "flicker") and left some elements —
 * the ones that paint from inline `var(--muted)`/`var(--card)` (kanban column
 * boxes, the Gantt sticky left rail) — stuck on dark, because html-to-image
 * can't reliably resolve theme CSS variables that hang off a `.dark` class on
 * the document root.
 *
 * This component sidesteps both by rendering the snapshot into a same-origin
 * `<iframe>` that is its own document: the parent's stylesheets and fonts are
 * cloned into it (so Tailwind utilities, the `:root` design tokens, and Open
 * Sans all apply), and its `<html>` never receives the `.dark` class. The result
 * is structurally light — no class toggling on the live page (no flicker), and
 * every `var()` reference resolves against a `:root` with no dark override in
 * scope (no leftover dark boxes).
 *
 * Stylesheets are copied by cloning the `<style>`/`<link>` nodes rather than
 * reading `document.styleSheets[].cssRules`, which avoids the cross-origin
 * `SecurityError` the Google Fonts stylesheet otherwise triggers.
 *
 * The same frame is the surface Phase 14.4 reuses: `iframe.contentWindow.print()`
 * for the printable-PDF route and `iframe.contentDocument.documentElement.outerHTML`
 * (styles already inlined) for the HTML download — one render path, shared with
 * the Phase 13 share viewer's components, no second harness to drift.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { forceLightDocumentElement, PRESENTATION_BACKGROUND } from '@/lib/presentationTheme'

export interface PresentationFrameProps {
  /**
   * Invoked once the frame's document is ready (styles copied, light theme
   * applied, body available). Pass the body to the PNG capture / HTML serialize.
   * Memoize this in the caller so it doesn't re-run the readiness effect.
   */
  onReady?: (body: HTMLElement, iframe: HTMLIFrameElement) => void
  children: ReactNode
}

/**
 * Clones the parent document's style and stylesheet/font link nodes into the
 * frame's head. Node-cloning (not `cssRules` serialization) is deliberate — it
 * copies Vite's dev `<style>` blocks and prod `<link>`s alike without reading
 * cross-origin sheets, which would throw `SecurityError` on the fonts stylesheet.
 */
function copyDocumentStyles(srcDoc: Document, destDoc: Document): void {
  const selector = [
    'style',
    'link[rel="stylesheet"]',
    'link[rel="preconnect"]',
    'link[as="style"]',
    'link[href*="fonts.googleapis"]',
    'link[href*="fonts.gstatic"]',
  ].join(',')
  srcDoc.querySelectorAll(selector).forEach(node => {
    destDoc.head.appendChild(node.cloneNode(true))
  })
}

export default function PresentationFrame({ onReady, children }: PresentationFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [body, setBody] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc) return

    // Never dark: the snapshot must be light regardless of the user's theme,
    // and we deliberately do not touch the parent <html> (that caused the flicker).
    forceLightDocumentElement(doc)
    copyDocumentStyles(document, doc)
    doc.body.style.margin = '0'
    doc.body.style.padding = '0'
    doc.body.style.background = PRESENTATION_BACKGROUND
    // Shrink-wrap to the content so scrollWidth/scrollHeight at capture time is
    // the view's full natural extent, not the iframe viewport.
    doc.body.style.display = 'inline-block'
    setBody(doc.body)
  }, [])

  useEffect(() => {
    if (body && iframeRef.current) onReady?.(body, iframeRef.current)
  }, [body, onReady])

  return (
    <>
      {/*
        Positioned at the viewport origin (not an extreme off-screen offset) so
        the browser actually paints/lays out the content — Chrome culls layout
        for nodes placed absurdly far outside any viewport, which left earlier
        captures blank. z-index -1 tucks it behind the export dialog's backdrop
        (z-1000), the only thing rendered alongside it, so it's never visible.
        Sized generously so width-flexible content lays out fully; the capture
        reads the body's own scroll extent regardless of this box.
      */}
      <iframe
        ref={iframeRef}
        title="Export presentation surface"
        aria-hidden
        // Defense-in-depth: nothing is ever given a src/srcdoc (stays
        // about:blank), but scripts and top-level navigation are blocked
        // outright in case that ever changes.
        sandbox="allow-same-origin"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 1440,
          height: 900,
          border: 0,
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
      {body && createPortal(children, body)}
    </>
  )
}
