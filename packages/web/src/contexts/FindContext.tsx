/**
 * FindContext — in-view event search state for the active Gantt view.
 *
 * Manages the find bar open/closed state, query input, debounced query,
 * the ordered list of matched event IDs (registered by GanttView after it
 * computes matches against its loaded data), and prev/next navigation.
 *
 * GanttView calls registerMatches whenever the match list changes; the
 * context stores the result and updates the active match index.
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

interface FindContextValue {
  findBarOpen: boolean
  setFindBarOpen: (open: boolean) => void
  query: string
  setQuery: (q: string) => void
  /** 150ms-debounced version of query — use this for matching. */
  debouncedQuery: string
  /** Ordered match IDs (row-order from GanttView). */
  matchedIds: string[]
  /** Per-event match reasons, e.g. ['description', 'assignee: Jane']. */
  matchReasons: Map<string, string[]>
  /** ID of the currently highlighted (active) match, or null. */
  activeMatchId: string | null
  /** 1-based index of the active match, 0 when nothing is active. */
  activeMatchIndex: number
  matchCount: number
  navigate: (dir: 1 | -1) => void
  /**
   * Called by GanttView when its computed match list changes.
   * Resets the active index to 0 when the list changes.
   */
  registerMatches: (orderedIds: string[], reasons: Map<string, string[]>) => void
}

const FindContext = createContext<FindContextValue | null>(null)

export function FindProvider({ children }: { children: React.ReactNode }) {
  const [findBarOpen, setFindBarOpenRaw] = useState(false)
  const [query, setQueryRaw] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [matchedIds, setMatchedIds] = useState<string[]>([])
  const [matchReasons, setMatchReasons] = useState<Map<string, string[]>>(new Map())
  const [activeIndex, setActiveIndex] = useState(0)

  const matchedIdsRef = useRef(matchedIds)
  matchedIdsRef.current = matchedIds

  // Debounce query updates
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(t)
  }, [query])

  // Reset active index when query changes so navigation starts from the top
  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  const setFindBarOpen = useCallback((open: boolean) => {
    setFindBarOpenRaw(open)
    if (!open) {
      // Clear query on close so the state is ephemeral
      setQueryRaw('')
      setDebouncedQuery('')
      setMatchedIds([])
      setMatchReasons(new Map())
      setActiveIndex(0)
    }
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q)
  }, [])

  const registerMatches = useCallback((orderedIds: string[], reasons: Map<string, string[]>) => {
    // Functional updaters bail out (no re-render) when values haven't changed,
    // breaking the GanttView→context→GanttView render cycle.
    setMatchedIds(prev =>
      prev.length === orderedIds.length && prev.every((id, i) => id === orderedIds[i])
        ? prev
        : orderedIds
    )
    setMatchReasons(prev => prev === reasons ? prev : reasons)
    setActiveIndex(0)
  }, [])

  const navigate = useCallback((dir: 1 | -1) => {
    const len = matchedIdsRef.current.length
    if (len === 0) return
    setActiveIndex(i => (i + dir + len) % len)
  }, [])

  const activeMatchId = matchedIds.length > 0 ? (matchedIds[activeIndex] ?? null) : null
  const activeMatchIndex = matchedIds.length > 0 ? activeIndex + 1 : 0
  const matchCount = matchedIds.length

  return (
    <FindContext.Provider value={{
      findBarOpen, setFindBarOpen,
      query, setQuery, debouncedQuery,
      matchedIds, matchReasons,
      activeMatchId, activeMatchIndex, matchCount,
      navigate, registerMatches,
    }}>
      {children}
    </FindContext.Provider>
  )
}

export function useFind(): FindContextValue {
  const ctx = useContext(FindContext)
  if (!ctx) throw new Error('useFind must be used inside FindProvider')
  return ctx
}
