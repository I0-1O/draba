/**
 * TagInput — combobox for selecting and creating activity tags.
 *
 * Selected tags render as colored pill badges with an × remove button.
 * Typing filters the team's existing tags; if no exact match exists a
 * "Create '<text>'" option appears at the bottom of the dropdown.
 */

import { useState, useRef, useEffect } from 'react'
import { X, Tag as TagIcon, Plus } from 'lucide-react'
import type { Tag } from '@/hooks/useTags'
import { useCreateTag } from '@/hooks/useTags'
import { resolveColorHex } from '@/components/identity/identity-constants'

// Cycle through identity palette colors for auto-created tags.
const DEFAULT_COLORS = ['teal', 'blue', 'violet', 'amber', 'green', 'red', 'indigo', 'pink']

interface Props {
  teamId: string
  tags: Tag[]
  selectedTagIds: string[]
  onChange: (ids: string[]) => void
}

export default function TagInput({ teamId, tags, selectedTagIds, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const createTag = useCreateTag(teamId)

  const selectedTags = selectedTagIds
    .map(id => tags.find(t => t.id === id))
    .filter(Boolean) as Tag[]

  const filtered = tags
    .filter(t => !selectedTagIds.includes(t.id))
    .filter(t => t.name.toLowerCase().includes(query.toLowerCase()))

  const exactMatch = tags.some(t => t.name.toLowerCase() === query.toLowerCase())
  const showCreate = query.trim().length > 0 && !exactMatch

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function removeTag(id: string) {
    onChange(selectedTagIds.filter(tid => tid !== id))
  }

  function selectTag(id: string) {
    onChange([...selectedTagIds, id])
    setQuery('')
    inputRef.current?.focus()
  }

  /**
   * Keyboard shortcuts inside the text field:
   *   Enter     → select an exact-name match if one exists, else create the tag
   *   Backspace → remove the last selected pill when the field is empty
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const trimmed = query.trim()
      if (!trimmed) return
      e.preventDefault()
      const exact = tags.find(
        t => t.name.toLowerCase() === trimmed.toLowerCase() && !selectedTagIds.includes(t.id),
      )
      if (exact) selectTag(exact.id)
      else if (showCreate) handleCreateTag()
    } else if (e.key === 'Backspace' && query === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id)
    }
  }

  function handleCreateTag() {
    const name = query.trim()
    if (!name) return
    const colorIdx = tags.length % DEFAULT_COLORS.length
    createTag.mutate(
      { name, color: DEFAULT_COLORS[colorIdx] },
      {
        onSuccess: (newTag) => {
          onChange([...selectedTagIds, newTag.id])
          setQuery('')
          inputRef.current?.focus()
        },
      }
    )
  }

  function tagColor(tag: Tag): string {
    if (!tag.color) return 'var(--muted-foreground)'
    return resolveColorHex(tag.color) ?? tag.color
  }

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative' }}>
      {/* Selected pills + text input */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
          minHeight: 28,
          padding: '3px 6px',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--background)',
          cursor: 'text',
        }}
      >
        {selectedTags.map(tag => (
          <span
            key={tag.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              padding: '1px 6px',
              borderRadius: 100,
              background: tagColor(tag) + '22',
              border: `1px solid ${tagColor(tag)}66`,
              color: 'var(--foreground)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: tagColor(tag),
                flexShrink: 0,
              }}
            />
            {tag.name}
            <button
              onMouseDown={e => { e.stopPropagation(); removeTag(tag.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: 'var(--muted-foreground)',
                lineHeight: 1,
              }}
            >
              <X size={9} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? 'Add tags…' : ''}
          style={{
            border: 'none',
            outline: 'none',
            background: 'none',
            fontSize: 12,
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
            flexGrow: 1,
            minWidth: 60,
            padding: '1px 2px',
          }}
        />
      </div>

      {/* Dropdown */}
      {open && (filtered.length > 0 || showCreate) && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,.12)',
            zIndex: 200,
            overflow: 'hidden',
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          {filtered.map(tag => (
            <div
              key={tag.id}
              onMouseDown={e => { e.preventDefault(); selectTag(tag.id) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <TagIcon size={11} style={{ color: tagColor(tag), flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{tag.name}</span>
            </div>
          ))}
          {showCreate && (
            <div
              onMouseDown={e => { e.preventDefault(); handleCreateTag() }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer',
                borderTop: filtered.length > 0 ? '1px solid var(--border)' : 'none',
                color: 'var(--primary)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={11} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              <span>Create &quot;{query.trim()}&quot;</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
