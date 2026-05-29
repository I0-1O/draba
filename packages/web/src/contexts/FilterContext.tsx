/**
 * Holds the dashboard-wide active filter selection. UI-only this round —
 * the selected filter is not yet applied to the events list (real views
 * land in Phase 8).
 */

import { createContext, useContext, useState } from 'react'

export type ActiveFilter =
  | { kind: 'preset'; id: 'all' | 'upcoming' | 'my' | 'overdue' | 'noassign' | 'open' }
  | { kind: 'member'; userId: string }
  | { kind: 'saved'; id: string }

interface FilterContextValue {
  activeFilter: ActiveFilter
  setActiveFilter: (f: ActiveFilter) => void
}

const FilterContext = createContext<FilterContextValue | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>({ kind: 'preset', id: 'all' })
  return (
    <FilterContext.Provider value={{ activeFilter, setActiveFilter }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter(): FilterContextValue {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used inside FilterProvider')
  return ctx
}
