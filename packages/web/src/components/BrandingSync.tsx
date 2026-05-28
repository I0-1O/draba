/**
 * BrandingSync — fetches /settings/branding on app start and applies:
 *   - instance name → document.title (and module-level makeDocTitle helper)
 *   - accent color  → --primary CSS variable override on <html>
 *
 * Renders nothing; exists only for side-effects.
 *
 * Page-level title pattern: import makeDocTitle and call it in a useEffect.
 * Example: document.title = makeDocTitle('Settings')  →  "Settings — Acme"
 */

import { useEffect } from 'react'
import { usePublicSettings } from '@/hooks/usePublicSettings'

// Shared at module level so makeDocTitle is always current without React context.
let _instanceBaseName = 'draba'

/** Returns a document title following the "{page} — {app}" convention. */
export function makeDocTitle(pageName?: string): string {
  return pageName ? `${pageName} — ${_instanceBaseName}` : _instanceBaseName
}

/** Hex color guard — rejects anything that isn't a 6-digit hex string. */
function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export default function BrandingSync() {
  const { data } = usePublicSettings()

  useEffect(() => {
    if (!data) return

    // Update the module-level name first so makeDocTitle is current for any
    // page titles set after this effect runs.
    _instanceBaseName = data.instanceName || 'draba'
    document.title = makeDocTitle()

    // Apply accent color override directly to --primary so all Tailwind utilities
    // (bg-primary, text-primary, ring-primary…) pick it up without extra CSS rules.
    // Removing the property falls back to the HSL value defined in index.css.
    const root = document.documentElement
    if (data.accentColor && isValidHex(data.accentColor)) {
      root.style.setProperty('--primary', data.accentColor)
    } else {
      root.style.removeProperty('--primary')
    }
  }, [data])

  return null
}
