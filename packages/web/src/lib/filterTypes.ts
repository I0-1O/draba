/**
 * Filter definition language for draba activity filters.
 *
 * A filter is stored as JSON in saved_filters.definition and evaluated
 * client-side by filterEngine.ts. The server treats the definition as an
 * opaque string and only validates that it is valid JSON.
 */

export type FilterLogic = 'and' | 'or'

// Operator categories by field type
export type StringOp = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty'
export type SetOp = 'in' | 'not_in' | 'is_empty' | 'is_not_empty'
export type NumberOp = 'equals' | 'not_equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'is_empty' | 'is_not_empty'
export type BoolOp = 'is_true' | 'is_false'
export type DateOp = 'before' | 'after' | 'between' | 'is_empty' | 'is_not_empty'

export type FilterCondition =
  | { field: 'status';   op: SetOp;    value: string[] }       // status NAMES, case-insensitive
  | { field: 'tag';      op: SetOp;    value: string[] }       // tag NAMES, case-insensitive
  | { field: 'assignee'; op: SetOp;    value: string[] }       // team_member_id values
  | { field: 'title';    op: StringOp; value: string }
  | { field: 'progress'; op: NumberOp; value: number }
  | { field: 'hasParent'; op: BoolOp }
  | { field: 'startDate'; op: DateOp;  value?: string | [string, string] }  // ISO date strings
  | { field: 'endDate';   op: DateOp;  value?: string | [string, string] }

export interface FilterDefinition {
  logic: FilterLogic
  conditions: FilterCondition[]
}

/** Parse a definition JSON string into a FilterDefinition, or return null on failure. */
export function parseFilterDefinition(json: string): FilterDefinition | null {
  try {
    const parsed = JSON.parse(json) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'logic' in (parsed as object) &&
      'conditions' in (parsed as object)
    ) {
      return parsed as FilterDefinition
    }
    return null
  } catch {
    return null
  }
}
