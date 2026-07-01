/**
 * htmlExport — unit tests for saveFramePresentationHtml (Phase 14.4).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveFramePresentationHtml } from './htmlExport'

let iframe: HTMLIFrameElement
let createObjectURL: ReturnType<typeof vi.fn>
let revokeObjectURL: ReturnType<typeof vi.fn>

beforeEach(() => {
  iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  iframe.contentDocument!.body.innerHTML = '<div>content</div>'

  createObjectURL = vi.fn(() => 'blob:mock-url')
  revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
})

afterEach(() => {
  iframe.remove()
  vi.unstubAllGlobals()
})

describe('saveFramePresentationHtml', () => {
  it('downloads a Blob containing the frame document with a header, then removes the header', () => {
    saveFramePresentationHtml(iframe, { timelineName: 'Q1 Plan', teamName: 'Acme', filterLabel: null }, 'q1-plan.html')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/html;charset=utf-8')

    // The header is inserted only for the instant of serialization, then removed —
    // it must not linger in the live frame document afterward.
    expect(iframe.contentDocument!.body.querySelector('[data-export-role="presentation-header"]')).toBeNull()
  })

  it('includes the serialized content in the downloaded blob', async () => {
    saveFramePresentationHtml(iframe, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null }, 'q1-plan.html')
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const text = await blob.text()
    expect(text).toContain('<!DOCTYPE html>')
    expect(text).toContain('Q1 Plan')
    expect(text).toContain('content')
  })

  it('does nothing when the frame has no contentDocument', () => {
    const detached = document.createElement('iframe')
    Object.defineProperty(detached, 'contentDocument', { value: null })
    expect(() =>
      saveFramePresentationHtml(detached, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null }, 'x.html'),
    ).not.toThrow()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
