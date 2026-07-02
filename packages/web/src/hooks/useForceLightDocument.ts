/**
 * useForceLightDocument — forces the live document light for the lifetime of
 * the mounting component, restoring the user's dark class on unmount.
 *
 * Extracted from ShareViewPage (Phase 14.4 review follow-up) so the
 * remove-then-restore contract is testable on its own; any future read-only
 * presentation route gets the same behavior by mounting this hook. See the
 * TASKS.md parking-lot entry on a fuller theme-mode classification
 * (light / dark / print / simplified) that would eventually subsume this.
 */

import { useLayoutEffect } from 'react'
import { forceLightDocumentElement } from '@/lib/presentationTheme'

export function useForceLightDocument(): void {
  // useLayoutEffect runs before the browser paints, beating any dark class
  // set from localStorage by useDarkMode during the same render cycle.
  useLayoutEffect(() => {
    const hadDark = forceLightDocumentElement(document)
    return () => {
      if (hadDark) document.documentElement.classList.add('dark')
    }
  }, [])
}
