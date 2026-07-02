/**
 * htmlExport — unit tests for saveFramePresentationHtml (Phase 14.4).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveFramePresentationHtml } from './htmlExport'

let iframe: HTMLIFrameElement
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

const info = { timelineName: 'Q1 Plan', teamName: 'Acme', filterLabel: null }

async function savedHtml(): Promise<string> {
  const blob = createObjectURL.mock.calls[0][0] as Blob
  return blob.text()
}

beforeEach(() => {
  iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  iframe.contentDocument!.body.innerHTML = '<div>content</div>'

  createObjectURL = vi.fn(() => 'blob:mock-url')
  revokeObjectURL = vi.fn()
  // Subclass keeps `new URL(...)` (used for link resolution) constructible
  // while adding the object-URL statics jsdom lacks — without mutating the
  // real global the way Object.assign(URL, ...) would.
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve('body{color:red}') }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  iframe.remove()
  vi.unstubAllGlobals()
})

describe('saveFramePresentationHtml', () => {
  it('downloads a Blob containing the frame document with a header, then removes the header', async () => {
    await saveFramePresentationHtml(iframe, info, 'q1-plan.html')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/html;charset=utf-8')

    // The header is inserted only for the instant of serialization, then removed —
    // it must not linger in the live frame document afterward.
    expect(iframe.contentDocument!.body.querySelector('[data-export-role="presentation-header"]')).toBeNull()
  })

  it('includes the serialized content in the downloaded blob', async () => {
    await saveFramePresentationHtml(iframe, { ...info, teamName: null }, 'q1-plan.html')
    const text = await savedHtml()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('Q1 Plan')
    expect(text).toContain('content')
  })

  it('inlines same-origin stylesheet links as <style> blocks', async () => {
    const link = iframe.contentDocument!.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('href', '/assets/index.css')
    iframe.contentDocument!.head.appendChild(link)

    await saveFramePresentationHtml(iframe, info, 'q1-plan.html')

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/assets/index.css'))
    const text = await savedHtml()
    expect(text).toContain('body{color:red}')
    expect(text).not.toContain('/assets/index.css')
    // The live frame document keeps its link — only the serialized clone is rewritten.
    expect(iframe.contentDocument!.head.querySelector('link[rel="stylesheet"]')).not.toBeNull()
  })

  it('absolutizes cross-origin font links instead of fetching them', async () => {
    const link = iframe.contentDocument!.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('href', 'https://fonts.googleapis.com/css2?family=Open+Sans')
    iframe.contentDocument!.head.appendChild(link)

    await saveFramePresentationHtml(iframe, info, 'q1-plan.html')

    expect(fetchMock).not.toHaveBeenCalled()
    const text = await savedHtml()
    expect(text).toContain('https://fonts.googleapis.com/css2?family=Open+Sans')
  })

  it('falls back to an absolute href when the same-origin stylesheet fetch fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, text: () => Promise.resolve('') })
    const link = iframe.contentDocument!.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('href', '/assets/index.css')
    iframe.contentDocument!.head.appendChild(link)

    await saveFramePresentationHtml(iframe, info, 'q1-plan.html')

    const text = await savedHtml()
    // Rewritten to a fully-qualified URL, so the export still styles when the app is reachable.
    expect(text).toContain(`${window.location.origin}/assets/index.css`)
  })

  it('does nothing when the frame has no contentDocument', async () => {
    const detached = document.createElement('iframe')
    Object.defineProperty(detached, 'contentDocument', { value: null })
    await expect(
      saveFramePresentationHtml(detached, { ...info, teamName: null }, 'x.html'),
    ).resolves.toBeUndefined()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
