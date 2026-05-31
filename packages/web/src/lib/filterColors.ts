/**
 * Derives a consistent accent color for a saved filter from its ID.
 * Uses a simple hash so the same filter always gets the same color
 * without storing color in the database.
 */

const PALETTE = [
  '#E05252', // red
  '#E07A3A', // orange
  '#C4980F', // amber
  '#3AAD6E', // green
  '#1E9E9E', // teal
  '#4A7FD4', // blue
  '#7B52D4', // purple
  '#C4528B', // pink
]

export function filterColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return PALETTE[h % PALETTE.length]
}
