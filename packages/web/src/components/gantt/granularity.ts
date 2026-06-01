/**
 * Time-granularity helpers for the Gantt view.
 *
 * Generates column definitions and maps event date ranges to fractional
 * column positions at any granularity (day → year).
 */

export type TimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface ColumnDef {
  label: string;
  /** Secondary label rendered on a second line (used for week numbers). */
  sublabel?: string;
  start: Date;
  end: Date;
  /** Calendar days this column spans (varies for months, quarters, years). */
  days: number;
}

// ── Date helpers ────────────────────────────────────────────────────────────
//
// All helpers operate in UTC so that all-day activity dates stored as
// midnight-UTC strings (e.g. "2026-05-31T00:00:00Z") land on the correct
// calendar day regardless of the viewer's local timezone.
//
// TODO: branch on allDay when timed events ship (Phase 15 calendar sync).

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setUTCHours(0, 0, 0, 0);
  return r;
}

function startOfWeek(d: Date, weekStart: 'monday' | 'sunday' = 'monday'): Date {
  const r = startOfDay(d);
  const day = r.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  if (weekStart === 'sunday') {
    r.setUTCDate(r.getUTCDate() - day);
  } else {
    // Monday = ISO week start
    r.setUTCDate(r.getUTCDate() - ((day + 6) % 7));
  }
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1));
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function endOfPeriod(start: Date, gran: TimeGranularity): Date {
  switch (gran) {
    case 'day':     return addDays(start, 1);
    case 'week':    return addDays(start, 7);
    case 'month':   return addMonths(start, 1);
    case 'quarter': return addMonths(start, 3);
    case 'year':    return addMonths(start, 12);
  }
}

function periodStart(d: Date, gran: TimeGranularity, weekStart: 'monday' | 'sunday' = 'monday'): Date {
  switch (gran) {
    case 'day':     return startOfDay(d);
    case 'week':    return startOfWeek(d, weekStart);
    case 'month':   return startOfMonth(d);
    case 'quarter': return startOfQuarter(d);
    case 'year':    return startOfYear(d);
  }
}

// ── Label formatting ────────────────────────────────────────────────────────

/** ISO 8601 week number (1–53). Week 1 contains Jan 4; weeks start Monday. */
function isoWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const week1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return 1 + Math.round(
    ((date.getTime() - week1.getTime()) / 86_400_000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7,
  );
}

function formatLabel(start: Date, gran: TimeGranularity, locale = 'en-US'): string {
  switch (gran) {
    case 'day':
      return start.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
    case 'week': {
      const end = addDays(start, 6);
      const sameMonth = start.getUTCMonth() === end.getUTCMonth();
      const s = start.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
      const e = sameMonth
        ? end.getUTCDate().toString()
        : end.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
      return `${s}–${e}`;
    }
    case 'month':
      return start.toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    case 'quarter': {
      const q = Math.floor(start.getUTCMonth() / 3) + 1;
      return `Q${q} ${start.getUTCFullYear()}`;
    }
    case 'year':
      return start.getUTCFullYear().toString();
  }
}

// ── Column generation ───────────────────────────────────────────────────────

export interface GenerateColumnsOptions {
  /** Which day the week grid starts on. Defaults to 'monday' (ISO). */
  weekStart?: 'monday' | 'sunday';
  /** BCP 47 locale tag for month name formatting. Defaults to 'en-US'. */
  locale?: string;
}

export function generateColumns(
  viewStart: Date,
  viewEnd: Date,
  granularity: TimeGranularity,
  options?: GenerateColumnsOptions,
): ColumnDef[] {
  const weekStart = options?.weekStart ?? 'monday';
  const locale = options?.locale ?? 'en-US';
  const columns: ColumnDef[] = [];
  let cur = periodStart(viewStart, granularity, weekStart);

  while (cur <= viewEnd) {
    const next = endOfPeriod(cur, granularity);
    // Clamp to view bounds for the first and last columns
    const colStart = cur < viewStart ? viewStart : cur;
    const colEnd = next > addDays(viewEnd, 1) ? addDays(viewEnd, 1) : next;
    columns.push({
      label: formatLabel(cur, granularity, locale),
      sublabel: granularity === 'week' ? `W${isoWeekNumber(cur)}` : undefined,
      start: cur,
      end: next,
      days: daysBetween(colStart, colEnd),
    });
    cur = next;
  }

  return columns;
}

// ── Event positioning ───────────────────────────────────────────────────────

/** Fractional position within the column array. */
export function positionInColumns(
  eventStart: Date,
  eventEnd: Date,
  columns: ColumnDef[],
): { startCol: number; span: number } {
  if (columns.length === 0) return { startCol: 0, span: 0 };

  const evStartMs = eventStart.getTime();
  const evEndMs = eventEnd.getTime();

  let startCol = 0;
  let endCol = columns.length;

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const colStartMs = col.start.getTime();
    const colEndMs = col.end.getTime();
    const colSpanMs = colEndMs - colStartMs;

    if (evStartMs >= colStartMs && evStartMs < colEndMs) {
      startCol = i + (colSpanMs > 0 ? (evStartMs - colStartMs) / colSpanMs : 0);
    }
    // End is inclusive day, so add 1 day for positioning
    const evEndNextDayMs = evEndMs + 86_400_000;
    if (evEndNextDayMs > colStartMs && evEndNextDayMs <= colEndMs) {
      endCol = i + (colSpanMs > 0 ? (evEndNextDayMs - colStartMs) / colSpanMs : 1);
    }
  }

  const span = Math.max(endCol - startCol, 0.15);
  return { startCol, span };
}

// ── Snap divisor ────────────────────────────────────────────────────────────

// Number of snap divisions per column at the given zoom granularity.
// Higher divisor → finer snap (e.g. week columns snap to individual days).
export function snapDivisorFor(granularity: TimeGranularity | 'auto'): number {
  switch (granularity) {
    case 'week':    return 7;  // snap to day within week
    case 'month':   return 4;  // snap to week within month
    case 'quarter': return 3;  // snap to month within quarter
    case 'year':    return 4;  // snap to quarter within year
    default:        return 1;  // day or auto → no finer snap
  }
}

// ── Today position ──────────────────────────────────────────────────────────

export function todayColumnPosition(columns: ColumnDef[]): number {
  const now = startOfDay(new Date()); // startOfDay uses setUTCHours → UTC midnight
  const nowMs = now.getTime();

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const colStartMs = col.start.getTime();
    const colEndMs = col.end.getTime();
    if (nowMs >= colStartMs && nowMs < colEndMs) {
      const colSpanMs = colEndMs - colStartMs;
      return i + (colSpanMs > 0 ? (nowMs - colStartMs) / colSpanMs : 0.5);
    }
  }
  return -1;
}

// ── Auto-fit ────────────────────────────────────────────────────────────────

const GRANULARITIES: TimeGranularity[] = ['day', 'week', 'month', 'quarter', 'year'];
const BASE_COL_WIDTH = 80;

export function autoFitGranularity(
  viewStart: Date,
  viewEnd: Date,
  viewportWidth: number,
): TimeGranularity {
  const targetCols = Math.max(viewportWidth / BASE_COL_WIDTH, 2);

  let best: TimeGranularity = 'month';
  let bestDiff = Infinity;

  for (const gran of GRANULARITIES) {
    const cols = generateColumns(viewStart, viewEnd, gran).length;
    if (cols < 2) continue;
    // Prefer the finest granularity that fits within 50-150% of viewport
    const ratio = cols / targetCols;
    if (ratio >= 0.4 && ratio <= 1.5) {
      // Within range — prefer finest (earliest in array)
      return gran;
    }
    const diff = Math.abs(ratio - 1);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = gran;
    }
  }

  return best;
}
