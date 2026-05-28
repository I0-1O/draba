/**
 * useFormatDate — returns a formatter that respects the user's stored
 * date_format preference.
 *
 * Supported formats (matching PreferencesPage options):
 *   "MMM D, YYYY"  → "Jan 5, 2026"
 *   "MM/DD/YYYY"   → "01/05/2026"
 *   "DD/MM/YYYY"   → "05/01/2026"
 *   "YYYY-MM-DD"   → "2026-01-05"
 */

import { useCallback } from 'react'
import { usePreferenceMap } from '@/hooks/usePreferences'

export type DateFormat = 'MMM D, YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatDate(date: Date, fmt: string): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()

  switch (fmt) {
    case 'MM/DD/YYYY':
      return `${pad2(m)}/${pad2(d)}/${y}`
    case 'DD/MM/YYYY':
      return `${pad2(d)}/${pad2(m)}/${y}`
    case 'YYYY-MM-DD':
      return `${y}-${pad2(m)}-${pad2(d)}`
    default:
      // "MMM D, YYYY" — default
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

/** Returns a stable formatter function for the user's date_format preference. */
export function useFormatDate(): (date: Date) => string {
  const prefMap = usePreferenceMap()
  const fmt = (prefMap['date_format'] as string | undefined) ?? 'MMM D, YYYY'
  return useCallback((date: Date) => formatDate(date, fmt), [fmt])
}
