/**
 * Calendar lane-packing algorithm.
 *
 * Pure functions only — no React, no DOM. Unit-tested in calendarLanes.test.ts.
 *
 * The core problem: given a set of all-day activities, assign each to a
 * vertical "lane" within its week row so that no two activities overlap in the
 * same lane. Activities that span week boundaries are split into per-week
 * segments and packed independently in each week row.
 */

export interface CalendarActivity {
  id: string;
  startAt: string; // ISO RFC3339 — treated as UTC all-day date
  endAt: string;   // ISO RFC3339 — treated as UTC all-day date
  title: string;
  color: string;
  icon?: string;
  assignedMemberIds: string[];
}

export interface CalendarSegment {
  activityId: string;
  /** 0-based column index within the 7-day week row (0 = first day). */
  startCol: number;
  /** 0-based column index, inclusive (0–6). */
  endCol: number;
  /** Lane index within the week row; 0 = topmost. */
  lane: number;
  /** Activity started before this week row — no left end-cap on the bar. */
  continuesLeft: boolean;
  /** Activity continues past this week row — no right end-cap on the bar. */
  continuesRight: boolean;
  color: string;
  title: string;
  icon?: string;
  assignedMemberIds: string[];
  isMatch: boolean;
  isActiveMatch: boolean;
}

export interface WeekRow {
  /** UTC midnight of the first day (Sunday or Monday per week_start pref). */
  weekStart: Date;
  /** 7 UTC midnight Dates — the days in display order. */
  days: Date[];
  segments: CalendarSegment[];
  /** Number of lanes needed to show all activities without overlap. */
  laneCount: number;
  /**
   * Maximum lanes to render before collapsing extras into "+N more".
   * Comes from the per-timeline user preference; defaults are passed in.
   */
  visibleLaneCap: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Days from `base` to `target` (positive = target is later). */
export function daysDiff(base: Date, target: Date): number {
  return Math.round((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
}

/** Build an array of 7 UTC midnight Dates starting from `weekStart`. */
function buildWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
}

// ── Greedy lane packing ───────────────────────────────────────────────────────

interface Candidate {
  activityId: string;
  startCol: number;
  endCol: number;
  continuesLeft: boolean;
  continuesRight: boolean;
  color: string;
  title: string;
  icon?: string;
  assignedMemberIds: string[];
  isMatch: boolean;
  isActiveMatch: boolean;
}

function packLanes(candidates: Candidate[]): CalendarSegment[] {
  // Sort by startCol ascending; ties: wider span first (stable visual ordering).
  const sorted = [...candidates].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return (b.endCol - b.startCol) - (a.endCol - a.startCol);
  });

  // lanes[i] = last endCol placed in lane i (-1 if lane is empty).
  const laneLastEnd: number[] = [];
  const result: CalendarSegment[] = [];

  for (const seg of sorted) {
    let lane = 0;
    // Find the lowest lane with no overlap: the previous segment in that lane
    // must have ended before this segment starts.
    while (lane < laneLastEnd.length && laneLastEnd[lane] >= seg.startCol) {
      lane++;
    }
    if (lane === laneLastEnd.length) laneLastEnd.push(-1);
    laneLastEnd[lane] = seg.endCol;
    result.push({ ...seg, lane });
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the packed WeekRow array for the calendar grid.
 *
 * @param activities    Already-filtered activities to display.
 * @param gridStart     UTC midnight of the first day of the first week row.
 * @param weekCount     Number of week rows (6 for month view, 1 for week view).
 * @param laneCaps      Per-timeline user preference: weekStart ISO → lane cap.
 * @param defaultLaneCap  Fallback cap when no user preference exists.
 * @param matchedIds    Set of activity IDs matching the current Find query.
 * @param activeMatchId The Find-navigation cursor activity ID (or null).
 */
export function buildCalendarWeeks(
  activities: CalendarActivity[],
  gridStart: Date,
  weekCount: number,
  laneCaps: Record<string, number>,
  defaultLaneCap: number,
  matchedIds: Set<string>,
  activeMatchId: string | null,
): WeekRow[] {
  return Array.from({ length: weekCount }, (_, wi) => {
    const weekStart = new Date(gridStart);
    weekStart.setUTCDate(gridStart.getUTCDate() + wi * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const days = buildWeekDays(weekStart);

    const candidates: Candidate[] = [];

    for (const act of activities) {
      // Parse as UTC all-day dates (midnight UTC).
      const actStart = new Date(act.startAt.slice(0, 10) + 'T00:00:00Z');
      const actEnd   = new Date(act.endAt.slice(0, 10)   + 'T00:00:00Z');

      // Skip activities with no intersection with this week.
      if (actEnd < weekStart || actStart > weekEnd) continue;

      const rawStartCol = daysDiff(weekStart, actStart);
      const rawEndCol   = daysDiff(weekStart, actEnd);

      const startCol = Math.max(0, rawStartCol);
      const endCol   = Math.min(6, rawEndCol);

      candidates.push({
        activityId: act.id,
        startCol,
        endCol,
        continuesLeft:  rawStartCol < 0,
        continuesRight: rawEndCol > 6,
        color: act.color,
        title: act.title,
        icon: act.icon,
        assignedMemberIds: act.assignedMemberIds,
        isMatch: matchedIds.has(act.id),
        isActiveMatch: act.id === activeMatchId,
      });
    }

    const segments  = packLanes(candidates);
    const laneCount = segments.length === 0 ? 0 : Math.max(...segments.map(s => s.lane)) + 1;
    const capKey    = weekStart.toISOString();
    const visibleLaneCap = laneCaps[capKey] ?? defaultLaneCap;

    return { weekStart, days, segments, laneCount, visibleLaneCap };
  });
}

/**
 * Compute per-day overflow counts — how many segments in the week row have
 * `lane >= visibleLaneCap` and overlap day column `col`.
 *
 * Returns a 7-element array indexed by column.
 */
export function overflowCountsForWeek(row: WeekRow): number[] {
  const counts = new Array<number>(7).fill(0);
  for (const seg of row.segments) {
    if (seg.lane < row.visibleLaneCap) continue;
    for (let col = seg.startCol; col <= seg.endCol; col++) {
      counts[col]++;
    }
  }
  return counts;
}

/**
 * Get all segments (visible and hidden) that touch a specific day column.
 * Used by the "+N more" day popover to list every activity on that day.
 */
export function segmentsForDay(row: WeekRow, col: number): CalendarSegment[] {
  return row.segments.filter(s => s.startCol <= col && col <= s.endCol);
}
