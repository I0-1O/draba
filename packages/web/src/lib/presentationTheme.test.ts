/**
 * presentationTheme — unit tests for the shared force-light helper (Phase 14.4).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { forceLightDocumentElement } from './presentationTheme'

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('forceLightDocumentElement', () => {
  it('removes the dark class and returns true when it was present', () => {
    document.documentElement.classList.add('dark')
    const hadDark = forceLightDocumentElement(document)
    expect(hadDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('returns false when the dark class was absent', () => {
    const hadDark = forceLightDocumentElement(document)
    expect(hadDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('operates on the given document, not necessarily the global document', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const doc = iframe.contentDocument!
    doc.documentElement.classList.add('dark')
    forceLightDocumentElement(doc)
    expect(doc.documentElement.classList.contains('dark')).toBe(false)
    iframe.remove()
  })
})
