/**
 * FindBar — in-view event search bar.
 *
 * Renders inside the TopBar when the find overlay is open. Wires directly
 * to FindContext for state; DashboardShell handles the Ctrl/Cmd+F keybinding
 * that triggers the open state.
 */

import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useFind } from '@/contexts/FindContext'
import { cn } from '@/lib/utils'

export default function FindBar() {
  const { query, setQuery, activeMatchIndex, matchCount, navigate, setFindBarOpen, debouncedQuery } = useFind()
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus the input as soon as the bar mounts
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setFindBarOpen(false)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      navigate(e.shiftKey ? -1 : 1)
    }
  }

  const hasQuery = debouncedQuery.trim().length > 0
  const noMatches = hasQuery && matchCount === 0

  return (
    <div className="flex items-center gap-1 h-7 px-2 border border-border rounded-md bg-card shrink-0 min-w-[260px]">
      <input
        ref={inputRef}
        type="text"
        placeholder="Find in view…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 min-w-0 border-none outline-none bg-transparent text-foreground text-xs"
      />

      {/* Match counter */}
      <span
        className={cn(
          'text-xs shrink-0 tabular-nums',
          noMatches ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {hasQuery
          ? noMatches
            ? 'No matches'
            : `${activeMatchIndex} / ${matchCount}`
          : ''}
      </span>

      {/* Prev / Next */}
      {hasQuery && matchCount > 0 && (
        <>
          <button
            onClick={() => navigate(-1)}
            title="Previous match (Shift+Enter)"
            className="flex items-center justify-center p-0.5 rounded hover:bg-muted cursor-pointer border-none bg-transparent text-muted-foreground"
          >
            <ChevronLeft size={13} strokeWidth={2} />
          </button>
          <button
            onClick={() => navigate(1)}
            title="Next match (Enter)"
            className="flex items-center justify-center p-0.5 rounded hover:bg-muted cursor-pointer border-none bg-transparent text-muted-foreground"
          >
            <ChevronRight size={13} strokeWidth={2} />
          </button>
        </>
      )}

      {/* Close */}
      <button
        onClick={() => setFindBarOpen(false)}
        title="Close (Esc)"
        className="flex items-center justify-center p-0.5 rounded hover:bg-muted cursor-pointer border-none bg-transparent text-muted-foreground"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  )
}
