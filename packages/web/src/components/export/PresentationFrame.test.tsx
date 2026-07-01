/**
 * PresentationFrame — behavior tests for the isolated, always-light iframe
 * surface the PNG export (and, in Phase 14.4, print/HTML export) renders
 * into. Covers the readiness contract (Phase 14.3 blocker): the frame must
 * never carry `.dark`, must shrink-wrap to its content, must clone the
 * parent's stylesheets so Tailwind/theme tokens resolve, and must portal
 * children into its own document rather than the live page.
 */

import '@testing-library/jest-dom'
import { describe, it, expect, afterEach, vi } from 'vitest'

// jsdom destroys an <iframe>'s contentDocument as soon as the <iframe> is
// detached, and React's automatic portal-unmount cleanup throws trying to
// remove the portaled node from that already-gone document — a jsdom/portal
// teardown quirk with no real-browser equivalent. Skip RTL's automatic
// per-test unmount (must be set before @testing-library/react is imported;
// vi.hoisted runs before the import below) — this file's tests render into
// fresh containers each time and never need the previous test's tree gone.
vi.hoisted(() => {
  process.env.RTL_SKIP_AUTO_CLEANUP = 'true'
})

import { render, waitFor } from '@testing-library/react'
import PresentationFrame from './PresentationFrame'

afterEach(() => {
  document.documentElement.classList.remove('dark')
  document.querySelectorAll('style[data-test-marker]').forEach(n => n.remove())
})

function getIframe(container: HTMLElement): HTMLIFrameElement {
  const iframe = container.querySelector('iframe')
  if (!iframe) throw new Error('expected an iframe to be rendered')
  return iframe
}

describe('PresentationFrame', () => {
  it('calls onReady with the frame body once the document is set up', async () => {
    const ready: { body: HTMLElement | null; iframe: HTMLIFrameElement | null } = { body: null, iframe: null }
    render(
      <PresentationFrame onReady={(body, iframe) => { ready.body = body; ready.iframe = iframe }}>
        <div>content</div>
      </PresentationFrame>,
    )

    await waitFor(() => expect(ready.body).not.toBeNull())
    expect(ready.iframe?.contentDocument?.body).toBe(ready.body)
  })

  it('never carries the dark class on the frame document, even when the live page is dark', async () => {
    document.documentElement.classList.add('dark')
    let readyBody: HTMLElement | null = null
    const { container } = render(
      <PresentationFrame onReady={body => { readyBody = body }}>
        <div>content</div>
      </PresentationFrame>,
    )

    await waitFor(() => expect(readyBody).not.toBeNull())
    const iframe = getIframe(container)
    expect(iframe.contentDocument?.documentElement.classList.contains('dark')).toBe(false)
    // The live page's own theme is left untouched — no flicker.
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('shrink-wraps the frame body to its content (white background, no margin)', async () => {
    let readyBody: HTMLElement | null = null
    render(
      <PresentationFrame onReady={body => { readyBody = body }}>
        <div>content</div>
      </PresentationFrame>,
    )

    await waitFor(() => expect(readyBody).not.toBeNull())
    const body = readyBody as unknown as HTMLElement
    expect(body.style.display).toBe('inline-block')
    expect(body.style.margin).toBe('0px')
    expect(body.style.background).toBe('rgb(255, 255, 255)')
  })

  it('clones stylesheet and font-link nodes from the parent document into the frame head', async () => {
    const marker = document.createElement('style')
    marker.setAttribute('data-test-marker', 'true')
    marker.textContent = '.test-marker { color: red; }'
    document.head.appendChild(marker)

    let readyBody: HTMLElement | null = null
    const { container } = render(
      <PresentationFrame onReady={body => { readyBody = body }}>
        <div>content</div>
      </PresentationFrame>,
    )

    await waitFor(() => expect(readyBody).not.toBeNull())
    const iframe = getIframe(container)
    const cloned = iframe.contentDocument?.head.querySelector('style[data-test-marker]')
    expect(cloned).toBeTruthy()
    expect(cloned?.textContent).toBe('.test-marker { color: red; }')
  })

  it('portals children into the frame body, not the live document', async () => {
    let readyBody: HTMLElement | null = null
    const { container } = render(
      <PresentationFrame onReady={body => { readyBody = body }}>
        <div data-testid="snapshot-content">portaled</div>
      </PresentationFrame>,
    )

    await waitFor(() => expect(readyBody).not.toBeNull())
    const iframe = getIframe(container)
    expect(iframe.contentDocument?.body.querySelector('[data-testid="snapshot-content"]')).toBeTruthy()
    expect(document.body.querySelector('[data-testid="snapshot-content"]')).toBeNull()
  })

  it('renders the iframe with a sandbox attribute restricting it to same-origin', () => {
    const { container } = render(
      <PresentationFrame>
        <div>content</div>
      </PresentationFrame>,
    )
    const iframe = getIframe(container)
    expect(iframe.getAttribute('sandbox')).toBe('allow-same-origin')
  })
})
