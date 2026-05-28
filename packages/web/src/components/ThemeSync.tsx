/**
 * ThemeSync — reads the user's server-side theme preference once auth
 * initializes, then applies it via useDarkMode.
 *
 * This component renders nothing; it exists only for its side-effect.
 * Mount it inside AuthProvider so useAuth is available.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDarkMode } from '@/hooks/useDarkMode'
import { usePreferenceMap } from '@/hooks/usePreferences'

export default function ThemeSync() {
  const { user, initializing } = useAuth()
  const { applyTheme } = useDarkMode()
  const prefMap = usePreferenceMap()
  const applied = useRef(false)

  useEffect(() => {
    // Only apply once per session to avoid overriding manual toggles.
    if (initializing || !user || applied.current) return
    const serverTheme = prefMap['theme'] as string | undefined
    if (serverTheme === 'dark' || serverTheme === 'light') {
      applyTheme(serverTheme)
      applied.current = true
    } else if (serverTheme !== undefined) {
      // Has a preference but it's something unexpected — mark applied to stop looping.
      applied.current = true
    }
  }, [initializing, user, prefMap, applyTheme])

  // Reset the applied guard when the user logs out.
  useEffect(() => {
    if (!user) applied.current = false
  }, [user])

  return null
}
