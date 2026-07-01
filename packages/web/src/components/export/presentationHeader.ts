/**
 * presentationHeader — builds the header strip (team/timeline, generated-at,
 * filter) shared by the print and HTML-save export formats (Phase 14.4).
 *
 * The PNG format (14.3) composites an equivalent header onto its output
 * canvas via `pngExport.ts`'s `compositeHeader` — that module is left
 * untouched here (it's already Docker-verified) rather than unified with
 * this DOM-based header, since the two formats need the info in different
 * shapes (canvas drawing vs. a real element). Print and HTML both need a
 * real DOM node, so they share this one.
 *
 * The header is inserted into the PresentationFrame document only for the
 * instant of the print/serialize call and removed immediately after — the
 * mounted Clean*Snapshot content itself never carries a header, so this
 * never interferes with a PNG capture of the same frame in the same dialog
 * session.
 */

import { PRESENTATION_BACKGROUND, PRESENTATION_FOREGROUND, PRESENTATION_MUTED, PRESENTATION_BORDER } from '@/lib/presentationTheme'

export interface PresentationHeaderInfo {
  timelineName: string
  teamName: string | null
  filterLabel: string | null
  /** Optional period context (Calendar's month/week label) — see pngExport's PngHeaderInfo. */
  periodLabel?: string | null
}

/** Builds the header strip as a detached element in `doc` — the caller inserts and removes it. */
export function buildPresentationHeaderElement(doc: Document, info: PresentationHeaderInfo): HTMLElement {
  const header = doc.createElement('div')
  header.setAttribute('data-export-role', 'presentation-header')
  header.style.cssText = [
    'display:flex', 'flex-direction:column', 'gap:2px', 'padding:14px 24px',
    `background:${PRESENTATION_BACKGROUND}`, `border-bottom:1px solid ${PRESENTATION_BORDER}`,
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';')

  const title = doc.createElement('div')
  title.style.cssText = `font-size:15px;font-weight:600;color:${PRESENTATION_FOREGROUND};`
  title.textContent = info.teamName ? `${info.teamName} · ${info.timelineName}` : info.timelineName
  header.appendChild(title)

  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  const subParts = [
    info.periodLabel,
    `Generated ${generatedAt}`,
    info.filterLabel ? `Filter: ${info.filterLabel}` : null,
  ].filter(Boolean)
  const sub = doc.createElement('div')
  sub.style.cssText = `font-size:12px;color:${PRESENTATION_MUTED};`
  sub.textContent = subParts.join(' · ')
  header.appendChild(sub)

  return header
}
