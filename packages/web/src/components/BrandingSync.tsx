/**
 * BrandingSync — fetches /settings/branding on app start and applies:
 *   - instance name → document.title
 *   - accent color  → --primary CSS variable override on <html>
 *
 * Renders nothing; exists only for side-effects.
 */

import { useEffect } from 'react'
import { usePublicSettings } from '@/hooks/usePublicSettings'

export default function BrandingSync() {
  const { data } = usePublicSettings()

  useEffect(() => {
    if (!data) return

    // Update the browser tab title if an instance name is configured.
    if (data.instanceName) {
      document.title = data.instanceName
    }

    // Apply accent color override as a CSS custom property. The accent color
    // is stored as a hex string (e.g. "#288C9B") and overrides --primary.
    const root = document.documentElement
    if (data.accentColor) {
      root.style.setProperty('--accent-override', data.accentColor)
    } else {
      root.style.removeProperty('--accent-override')
    }
  }, [data])

  return null
}
