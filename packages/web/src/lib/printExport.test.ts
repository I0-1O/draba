/**
 * printExport — unit tests for printPresentationFrame (Phase 14.4).
 *
 * Uses a real, attached <iframe> so contentDocument/contentWindow exist
 * (jsdom provides both), with `print`/`focus`/`addEventListener` spied on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printPresentationFrame } from './printExport'

let iframe: HTMLIFrameElement

beforeEach(() => {
  iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  iframe.contentDocument!.body.innerHTML = '<div>content</div>'
})

afterEach(() => {
  iframe.remove()
})

describe('printPresentationFrame', () => {
  it('inserts a header element as the first child of the frame body before printing', () => {
    const printSpy = vi.spyOn(iframe.contentWindow!, 'print').mockImplementation(() => {})
    printPresentationFrame(iframe, { timelineName: 'Q1 Plan', teamName: 'Acme', filterLabel: null })

    const first = iframe.contentDocument!.body.firstElementChild
    expect(first?.getAttribute('data-export-role')).toBe('presentation-header')
    expect(first?.textContent).toContain('Acme · Q1 Plan')
    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('focuses the frame window before printing', () => {
    vi.spyOn(iframe.contentWindow!, 'print').mockImplementation(() => {})
    const focusSpy = vi.spyOn(iframe.contentWindow!, 'focus')
    printPresentationFrame(iframe, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })
    expect(focusSpy).toHaveBeenCalledTimes(1)
  })

  it('removes the header once the frame fires afterprint', () => {
    vi.spyOn(iframe.contentWindow!, 'print').mockImplementation(() => {})
    printPresentationFrame(iframe, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })
    expect(iframe.contentDocument!.body.querySelector('[data-export-role="presentation-header"]')).toBeTruthy()

    iframe.contentWindow!.dispatchEvent(new Event('afterprint'))
    expect(iframe.contentDocument!.body.querySelector('[data-export-role="presentation-header"]')).toBeNull()
  })

  it('does nothing when the frame has no contentDocument', () => {
    const detached = document.createElement('iframe')
    Object.defineProperty(detached, 'contentDocument', { value: null })
    Object.defineProperty(detached, 'contentWindow', { value: null })
    expect(() => printPresentationFrame(detached, { timelineName: 'Q1 Plan', teamName: null, filterLabel: null })).not.toThrow()
  })
})
