/**
 * useForceLightDocument — tests for the force-light-with-restore lifecycle
 * used by ShareViewPage (Phase 14.4 review follow-up).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useForceLightDocument } from './useForceLightDocument'

afterEach(() => {
  document.documentElement.classList.remove('dark')
})

describe('useForceLightDocument', () => {
  it('strips the dark class on mount and restores it on unmount', () => {
    document.documentElement.classList.add('dark')
    const { unmount } = renderHook(() => useForceLightDocument())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    unmount()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('does not add a dark class on unmount when the user was already light', () => {
    const { unmount } = renderHook(() => useForceLightDocument())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    unmount()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
