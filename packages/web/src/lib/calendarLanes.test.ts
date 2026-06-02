import { describe, it, expect } from 'vitest';
import {
  buildCalendarWeeks,
  overflowCountsForWeek,
  segmentsForDay,
  daysDiff,
  type CalendarActivity,
} from './calendarLanes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function utc(iso: string): Date {
  return new Date(iso + 'T00:00:00Z');
}

function makeActivity(overrides: Partial<CalendarActivity> & { id: string; startAt: string; endAt: string }): CalendarActivity {
  return {
    title: overrides.id,
    color: '#288C9B',
    assignedMemberIds: [],
    ...overrides,
  };
}

const EMPTY_CAPS = {};
const NO_MATCHES = new Set<string>();

// Grid starts Monday 2026-06-01
const GRID_START = utc('2026-06-01');

// ── daysDiff ──────────────────────────────────────────────────────────────────

describe('daysDiff', () => {
  it('returns 0 for same date', () => {
    expect(daysDiff(utc('2026-06-01'), utc('2026-06-01'))).toBe(0);
  });
  it('returns positive for later target', () => {
    expect(daysDiff(utc('2026-06-01'), utc('2026-06-03'))).toBe(2);
  });
  it('returns negative for earlier target', () => {
    expect(daysDiff(utc('2026-06-03'), utc('2026-06-01'))).toBe(-2);
  });
});

// ── buildCalendarWeeks — basic single week ────────────────────────────────────

describe('buildCalendarWeeks — single week', () => {
  it('returns one WeekRow with 7 days', () => {
    const weeks = buildCalendarWeeks([], GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].days).toHaveLength(7);
  });

  it('days are in correct UTC order', () => {
    const weeks = buildCalendarWeeks([], GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    expect(weeks[0].days[0].toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(weeks[0].days[6].toISOString().slice(0, 10)).toBe('2026-06-07');
  });

  it('applies default lane cap when no user cap is set', () => {
    const weeks = buildCalendarWeeks([], GRID_START, 1, EMPTY_CAPS, 4, NO_MATCHES, null);
    expect(weeks[0].visibleLaneCap).toBe(4);
  });

  it('applies per-week lane cap when set', () => {
    const cap: Record<string, number> = { [GRID_START.toISOString()]: 2 };
    const weeks = buildCalendarWeeks([], GRID_START, 1, cap, 4, NO_MATCHES, null);
    expect(weeks[0].visibleLaneCap).toBe(2);
  });
});

// ── buildCalendarWeeks — single-day activity ──────────────────────────────────

describe('buildCalendarWeeks — single-day activity', () => {
  it('places a single-day activity in lane 0, column matching its date', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a1', startAt: '2026-06-03T00:00:00Z', endAt: '2026-06-03T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const seg = weeks[0].segments[0];
    expect(seg.activityId).toBe('a1');
    expect(seg.startCol).toBe(2); // Wed = col 2 (Mon=0, Tue=1, Wed=2)
    expect(seg.endCol).toBe(2);
    expect(seg.lane).toBe(0);
    expect(seg.continuesLeft).toBe(false);
    expect(seg.continuesRight).toBe(false);
  });

  it('excludes activities outside the week', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a1', startAt: '2026-06-08T00:00:00Z', endAt: '2026-06-08T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    expect(weeks[0].segments).toHaveLength(0);
  });
});

// ── buildCalendarWeeks — multi-day activity ───────────────────────────────────

describe('buildCalendarWeeks — multi-day activity', () => {
  it('spans the correct columns', () => {
    // Mon Jun 1 → Thu Jun 4
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a1', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-04T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const seg = weeks[0].segments[0];
    expect(seg.startCol).toBe(0);
    expect(seg.endCol).toBe(3);
  });

  it('marks continuesLeft when activity started before the week', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a1', startAt: '2026-05-28T00:00:00Z', endAt: '2026-06-03T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const seg = weeks[0].segments[0];
    expect(seg.continuesLeft).toBe(true);
    expect(seg.startCol).toBe(0);
  });

  it('marks continuesRight when activity ends after the week', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a1', startAt: '2026-06-05T00:00:00Z', endAt: '2026-06-10T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const seg = weeks[0].segments[0];
    expect(seg.continuesRight).toBe(true);
    expect(seg.endCol).toBe(6);
  });
});

// ── buildCalendarWeeks — multi-week activity ──────────────────────────────────

describe('buildCalendarWeeks — activity spanning two weeks', () => {
  it('appears in both week rows', () => {
    // Mon Jun 1 → Mon Jun 8 (spans two weeks)
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'long', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-08T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 2, EMPTY_CAPS, 3, NO_MATCHES, null);
    expect(weeks[0].segments).toHaveLength(1);
    expect(weeks[1].segments).toHaveLength(1);
    expect(weeks[0].segments[0].continuesRight).toBe(true);
    expect(weeks[1].segments[0].continuesLeft).toBe(true);
    expect(weeks[1].segments[0].continuesRight).toBe(false);
  });
});

// ── buildCalendarWeeks — lane packing ─────────────────────────────────────────

describe('buildCalendarWeeks — greedy lane packing', () => {
  it('puts non-overlapping same-week activities in lane 0', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-06-03T00:00:00Z', endAt: '2026-06-03T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const lanes = weeks[0].segments.map(s => s.lane);
    expect(lanes).toEqual([0, 0]);
  });

  it('puts overlapping activities in separate lanes', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-05T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-06-03T00:00:00Z', endAt: '2026-06-07T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const laneById = Object.fromEntries(weeks[0].segments.map(s => [s.activityId, s.lane]));
    expect(laneById['a']).toBe(0);
    expect(laneById['b']).toBe(1);
  });

  it('reuses a lane after a segment ends', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-02T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-02T00:00:00Z' }),
      makeActivity({ id: 'c', startAt: '2026-06-04T00:00:00Z', endAt: '2026-06-05T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const laneById = Object.fromEntries(weeks[0].segments.map(s => [s.activityId, s.lane]));
    // a and b overlap → different lanes; c doesn't overlap with a or b so it fits in lane 0
    expect(laneById['a']).toBe(0);
    expect(laneById['b']).toBe(1);
    expect(laneById['c']).toBe(0);
  });

  it('computes laneCount correctly', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-07T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-07T00:00:00Z' }),
      makeActivity({ id: 'c', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-07T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    expect(weeks[0].laneCount).toBe(3);
  });
});

// ── overflowCountsForWeek ─────────────────────────────────────────────────────

describe('overflowCountsForWeek', () => {
  it('returns all-zeros when no segments exceed cap', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const counts = overflowCountsForWeek(weeks[0]);
    expect(counts.every(c => c === 0)).toBe(true);
  });

  it('counts hidden segments per day column', () => {
    // 4 activities all on Mon (col 0) — cap=3, so 1 overflows
    const acts: CalendarActivity[] = Array.from({ length: 4 }, (_, i) =>
      makeActivity({ id: `a${i}`, startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' }),
    );
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const counts = overflowCountsForWeek(weeks[0]);
    expect(counts[0]).toBe(1); // 1 overflows on Mon (col 0)
    expect(counts[1]).toBe(0); // other days unaffected
  });
});

// ── segmentsForDay ────────────────────────────────────────────────────────────

describe('segmentsForDay', () => {
  it('returns all segments touching the given day column', () => {
    // Activity spans Mon–Wed (cols 0–2); another only on Thu (col 3)
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'span', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-03T00:00:00Z' }),
      makeActivity({ id: 'thu',  startAt: '2026-06-04T00:00:00Z', endAt: '2026-06-04T00:00:00Z' }),
    ];
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, NO_MATCHES, null);
    const onTue = segmentsForDay(weeks[0], 1);
    expect(onTue.map(s => s.activityId)).toContain('span');
    expect(onTue.map(s => s.activityId)).not.toContain('thu');
  });
});

// ── Find match flags ──────────────────────────────────────────────────────────

describe('buildCalendarWeeks — find match flags', () => {
  it('sets isMatch on matching activities', () => {
    const acts: CalendarActivity[] = [
      makeActivity({ id: 'a', startAt: '2026-06-01T00:00:00Z', endAt: '2026-06-01T00:00:00Z' }),
      makeActivity({ id: 'b', startAt: '2026-06-02T00:00:00Z', endAt: '2026-06-02T00:00:00Z' }),
    ];
    const matched = new Set(['a']);
    const weeks = buildCalendarWeeks(acts, GRID_START, 1, EMPTY_CAPS, 3, matched, 'a');
    const segs = Object.fromEntries(weeks[0].segments.map(s => [s.activityId, s]));
    expect(segs['a'].isMatch).toBe(true);
    expect(segs['a'].isActiveMatch).toBe(true);
    expect(segs['b'].isMatch).toBe(false);
    expect(segs['b'].isActiveMatch).toBe(false);
  });
});
