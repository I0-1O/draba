/**
 * htmlExport — serializes the PresentationFrame's document to a standalone
 * `.html` file (Phase 14.4).
 *
 * PresentationFrame clones the parent document's `<style>`/`<link>` nodes into
 * the frame's head. Vite's dev `<style>` blocks serialize as-is, but `<link>`
 * hrefs don't survive a save-to-disk: same-origin `/assets/*.css` links stop
 * resolving once the file leaves the server, and relative font links lose
 * their base. So at serialize time the document is cloned and its links are
 * resolved: same-origin stylesheets are fetched and inlined as `<style>`
 * blocks; cross-origin links (the Google Fonts pair) are rewritten to
 * absolute URLs so the fonts still load when the file is opened with network
 * access (system-font fallback offline). The live frame document is never
 * mutated beyond the transient header insert.
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

/**
 * Resolves every `<link href>` in the cloned root against the parent page's
 * URL: same-origin stylesheets become inline `<style>` blocks (fetch failure
 * falls back to an absolute href); everything else is absolutized in place.
 */
async function inlineStylesheetLinks(root: HTMLElement): Promise<void> {
  const links = Array.from(root.querySelectorAll<HTMLLinkElement>('link[href]'))
  await Promise.all(links.map(async link => {
    const href = link.getAttribute('href')
    if (!href) return
    const url = new URL(href, document.baseURI)
    if (link.rel === 'stylesheet' && url.origin === window.location.origin) {
      try {
        const res = await fetch(url.href)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const css = await res.text()
        const style = root.ownerDocument.createElement('style')
        style.textContent = css
        link.replaceWith(style)
        return
      } catch {
        // Fall through to absolutizing — the export still opens, styled,
        // whenever the app origin is reachable.
      }
    }
    link.setAttribute('href', url.href)
  }))
}

/** Serializes the PresentationFrame's document (with a header inserted for the capture) and downloads it. */
export async function saveFramePresentationHtml(iframe: HTMLIFrameElement, info: PresentationHeaderInfo, filename: string): Promise<void> {
  const doc = iframe.contentDocument
  if (!doc) return

  const header = buildPresentationHeaderElement(doc, info)
  doc.body.insertBefore(header, doc.body.firstChild)
  const root = doc.documentElement.cloneNode(true) as HTMLElement
  header.remove()

  await inlineStylesheetLinks(root)
  const html = `<!DOCTYPE html>\n${root.outerHTML}`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveBlob(blob, filename)
}
