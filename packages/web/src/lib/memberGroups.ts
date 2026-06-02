/**
 * memberGroups — shared helpers for "group by member combination."
 * Used by both GanttView and ListView so the two views stay identical in
 * key generation, label formatting, and group ordering.
 */

export const UNASSIGNED_KEY = '__unassigned__';
export const SEP = '|';

/** Stable composite key for a set of assignee IDs. Order-independent. */
export function memberComboKey(ids: string[]): string {
  if (ids.length === 0) return UNASSIGNED_KEY;
  return [...ids].sort().join(SEP);
}

/**
 * Returns the IDs from the combination in team-member order (as they appear
 * in the memberOrder array). Used for label generation and header dots.
 */
export function orderedComboIds(ids: string[], memberOrder: string[]): string[] {
  const orderIndex = new Map(memberOrder.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => {
    const ia = orderIndex.get(a) ?? Infinity;
    const ib = orderIndex.get(b) ?? Infinity;
    return ia - ib;
  });
}

/**
 * Human-readable label for a combination, in team order:
 * 1 → "Alice" | 2 → "Alice and Bob" | 3 → "Alice, Bob, and Carol" | 4+ → "Alice, Bob, Carol +N"
 */
export function memberComboLabel(orderedIds: string[], nameById: Map<string, string>): string {
  const names = orderedIds.map(id => nameById.get(id) ?? 'Unknown');
  if (names.length === 0) return 'Unassigned';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

/**
 * Sort comparator for combo keys. Groups cluster by anchor member in team
 * order ("Alice", "Alice + Bob", "Alice + Carol", …, "Bob", …); Unassigned last.
 *
 * Uses lexicographic comparison over each member's team-order index; missing
 * positions are treated as -1 so single-member groups precede multi-member
 * groups that share the same anchor.
 */
export function comboSortComparator(memberOrder: string[]): (a: string, b: string) => number {
  const orderIndex = new Map(memberOrder.map((id, i) => [id, i]));

  function indices(key: string): number[] {
    if (key === UNASSIGNED_KEY) return [Infinity];
    return key
      .split(SEP)
      .map(id => orderIndex.get(id) ?? Infinity)
      .sort((a, b) => a - b); // ascending = team order
  }

  return (a: string, b: string): number => {
    const ia = indices(a);
    const ib = indices(b);
    const len = Math.max(ia.length, ib.length);
    for (let i = 0; i < len; i++) {
      // Use -1 for missing positions so shorter combos sort before longer ones
      // that share the same anchor (e.g. "Alice" before "Alice + Bob").
      const va = ia[i] ?? -1;
      const vb = ib[i] ?? -1;
      if (va !== vb) return va - vb;
    }
    return 0;
  };
}
