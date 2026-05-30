/**
 * TagInput — unit tests for tag pill selection and "create on the fly" behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TagInput from './TagInput'
import type { Tag } from '@/hooks/useTags'

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockCreateMutate = vi.fn()

vi.mock('@/hooks/useTags', () => ({
  useCreateTag: () => ({ mutate: mockCreateMutate, isPending: false }),
}))

vi.mock('@/components/identity/identity-constants', () => ({
  resolveColorHex: (color: string) => color,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TAGS: Tag[] = [
  { id: 'tag-1', teamId: 'team-1', name: 'urgent', color: 'red', createdBy: 'u1', createdAt: '' },
  { id: 'tag-2', teamId: 'team-1', name: 'design', color: 'blue', createdBy: 'u1', createdAt: '' },
]

function renderTagInput(
  selectedTagIds: string[] = [],
  onChange = vi.fn(),
  tags = TAGS,
) {
  return render(
    <TagInput
      teamId="team-1"
      tags={tags}
      selectedTagIds={selectedTagIds}
      onChange={onChange}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TagInput', () => {
  beforeEach(() => mockCreateMutate.mockClear())

  it('renders placeholder when nothing is selected', () => {
    renderTagInput()
    expect(screen.getByPlaceholderText('Add tags…')).toBeTruthy()
  })

  it('renders selected tag as a pill', () => {
    renderTagInput(['tag-1'])
    expect(screen.getByText('urgent')).toBeTruthy()
    // Placeholder hides when a tag is selected.
    expect(screen.queryByPlaceholderText('Add tags…')).toBeFalsy()
  })

  it('calls onChange with filtered-out ID when × is clicked', () => {
    const onChange = vi.fn()
    renderTagInput(['tag-1', 'tag-2'], onChange)

    // Click the × on "urgent" (first pill).
    const removeButtons = screen.getAllByRole('button')
    fireEvent.mouseDown(removeButtons[0])

    expect(onChange).toHaveBeenCalledWith(['tag-2'])
  })

  it('shows filtered dropdown options when typing', () => {
    renderTagInput()
    const input = screen.getByPlaceholderText('Add tags…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'urg' } })

    expect(screen.getByText('urgent')).toBeTruthy()
    expect(screen.queryByText('design')).toBeFalsy()
  })

  it('shows "Create" option when text has no exact match', () => {
    renderTagInput()
    const input = screen.getByPlaceholderText('Add tags…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'newTag' } })

    expect(screen.getByText('Create "newTag"')).toBeTruthy()
  })

  it('does not show "Create" option when text exactly matches an existing tag', () => {
    renderTagInput()
    const input = screen.getByPlaceholderText('Add tags…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'urgent' } })

    expect(screen.queryByText(/Create/)).toBeFalsy()
  })

  it('calls onChange with selected ID when a dropdown item is clicked', () => {
    const onChange = vi.fn()
    renderTagInput([], onChange)
    const input = screen.getByPlaceholderText('Add tags…')
    fireEvent.focus(input)

    // "urgent" and "design" should both appear in the dropdown.
    const item = screen.getByText('urgent')
    fireEvent.mouseDown(item)

    expect(onChange).toHaveBeenCalledWith(['tag-1'])
  })

  it('calls createTag.mutate when "Create" option is clicked', () => {
    renderTagInput()
    const input = screen.getByPlaceholderText('Add tags…')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sprint' } })

    fireEvent.mouseDown(screen.getByText('Create "sprint"'))

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sprint' }),
      expect.any(Object),
    )
  })

  it('removes the last tag on Backspace when input is empty', () => {
    const onChange = vi.fn()
    renderTagInput(['tag-1', 'tag-2'], onChange)

    // Input has no placeholder when tags are selected; target it by its role.
    const inputs = document.querySelectorAll('input')
    fireEvent.keyDown(inputs[0], { key: 'Backspace' })

    expect(onChange).toHaveBeenCalledWith(['tag-1'])
  })
})
