/**
 * memberGroups — unit tests for combo key, label, ordering, and sort comparator.
 */

import { describe, it, expect } from 'vitest'
import {
  memberComboKey,
  orderedComboIds,
  memberComboLabel,
  comboSortComparator,
  UNASSIGNED_KEY,
} from './memberGroups'

// ── memberComboKey ──────────────────────────────────────────────────────────

describe('memberComboKey', () => {
  it('returns UNASSIGNED_KEY for empty array', () => {
    expect(memberComboKey([])).toBe(UNASSIGNED_KEY)
  })

  it('returns the single id for a solo assignee', () => {
    expect(memberComboKey(['abc'])).toBe('abc')
  })

  it('sorts ids before joining so order of input does not matter', () => {
    expect(memberComboKey(['b', 'a'])).toBe(memberComboKey(['a', 'b']))
  })

  it('produces the same key for any permutation of three ids', () => {
    const k = memberComboKey(['c', 'a', 'b'])
    expect(memberComboKey(['a', 'b', 'c'])).toBe(k)
    expect(memberComboKey(['b', 'c', 'a'])).toBe(k)
  })
})

// ── orderedComboIds ─────────────────────────────────────────────────────────

describe('orderedComboIds', () => {
  const order = ['m1', 'm2', 'm3']

  it('returns ids in team order', () => {
    expect(orderedComboIds(['m3', 'm1'], order)).toEqual(['m1', 'm3'])
  })

  it('handles a single id', () => {
    expect(orderedComboIds(['m2'], order)).toEqual(['m2'])
  })

  it('places unknown ids last (stable)', () => {
    const result = orderedComboIds(['unknown', 'm1'], order)
    expect(result[0]).toBe('m1')
    expect(result[1]).toBe('unknown')
  })
})

// ── memberComboLabel ────────────────────────────────────────────────────────

describe('memberComboLabel', () => {
  const names = new Map([['m1', 'Alice'], ['m2', 'Bob'], ['m3', 'Carol'], ['m4', 'Dave'], ['m5', 'Eve']])

  it('1 member → bare name', () => {
    expect(memberComboLabel(['m1'], names)).toBe('Alice')
  })

  it('2 members → "A and B"', () => {
    expect(memberComboLabel(['m1', 'm2'], names)).toBe('Alice and Bob')
  })

  it('3 members → "A, B, and C"', () => {
    expect(memberComboLabel(['m1', 'm2', 'm3'], names)).toBe('Alice, Bob, and Carol')
  })

  it('4 members → "A, B, C +1"', () => {
    expect(memberComboLabel(['m1', 'm2', 'm3', 'm4'], names)).toBe('Alice, Bob, Carol +1')
  })

  it('5 members → "A, B, C +2"', () => {
    expect(memberComboLabel(['m1', 'm2', 'm3', 'm4', 'm5'], names)).toBe('Alice, Bob, Carol +2')
  })

  it('unknown id falls back to "Unknown"', () => {
    expect(memberComboLabel(['nope'], names)).toBe('Unknown')
  })
})

// ── comboSortComparator ─────────────────────────────────────────────────────

describe('comboSortComparator', () => {
  const order = ['m1', 'm2', 'm3']
  const cmp = comboSortComparator(order)

  function key(...ids: string[]) { return memberComboKey(ids) }

  it('solo Alice before solo Bob', () => {
    expect(cmp(key('m1'), key('m2'))).toBeLessThan(0)
  })

  it('solo Alice before Alice+Bob', () => {
    expect(cmp(key('m1'), key('m1', 'm2'))).toBeLessThan(0)
  })

  it('Alice+Bob before Alice+Carol', () => {
    expect(cmp(key('m1', 'm2'), key('m1', 'm3'))).toBeLessThan(0)
  })

  it('Alice+Carol before solo Bob', () => {
    expect(cmp(key('m1', 'm3'), key('m2'))).toBeLessThan(0)
  })

  it('solo Bob before Bob+Carol', () => {
    expect(cmp(key('m2'), key('m2', 'm3'))).toBeLessThan(0)
  })

  it('Unassigned is last', () => {
    expect(cmp(UNASSIGNED_KEY, key('m3'))).toBeGreaterThan(0)
    expect(cmp(key('m1'), UNASSIGNED_KEY)).toBeLessThan(0)
  })

  it('equal keys compare as 0', () => {
    expect(cmp(key('m1', 'm2'), key('m2', 'm1'))).toBe(0)
  })

  it('sorts a mixed list into the expected cluster order', () => {
    const keys = [
      UNASSIGNED_KEY,
      key('m2'),
      key('m1', 'm3'),
      key('m1'),
      key('m1', 'm2'),
      key('m3'),
      key('m2', 'm3'),
    ].sort(cmp)
    expect(keys).toEqual([
      key('m1'),
      key('m1', 'm2'),
      key('m1', 'm3'),
      key('m2'),
      key('m2', 'm3'),
      key('m3'),
      UNASSIGNED_KEY,
    ])
  })
})
