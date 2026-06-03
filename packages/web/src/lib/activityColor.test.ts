/**
 * Tests for resolveActivityColor — the shared color-by helper used by all
 * three views (Gantt, List, Calendar).
 */

import { describe, it, expect } from 'vitest';
import { resolveActivityColor } from './activityColor';
import { ACTIVITY_COLORS } from '@/types';
import type { components } from '@draba/shared';
import type { Member } from '@/types';

type ApiActivity = components['schemas']['Activity'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<ApiActivity> = {}): ApiActivity {
  return {
    id: 'act-1',
    title: 'Test',
    timelineId: 'tl-1',
    startAt: '2026-05-01T00:00:00Z',
    endAt: '2026-05-02T00:00:00Z',
    color: '#ff0000',
    assignedMemberIds: [],
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as ApiActivity;
}

function makeMember(id: string, color: string): Member {
  return { id, name: 'Test User', initials: 'TU', color };
}

const NO_MEMBERS: Record<string, Member> = {};
const NO_STATUS_COLORS = new Map<string, string>();

// ── colorBy='activity' ────────────────────────────────────────────────────────

describe('resolveActivityColor — colorBy=activity', () => {
  it('returns activity.color when set', () => {
    const act = makeActivity({ color: '#abcdef' });
    expect(resolveActivityColor(act, 0, NO_MEMBERS, 'activity', NO_STATUS_COLORS)).toBe('#abcdef');
  });

  it('cycles through ACTIVITY_COLORS by index when activity.color is null', () => {
    // reason: the API type allows null but the runtime value can be null
    const act = makeActivity({ color: null as unknown as string });
    const result = resolveActivityColor(act, 2, NO_MEMBERS, 'activity', NO_STATUS_COLORS);
    expect(result).toBe(ACTIVITY_COLORS[2 % ACTIVITY_COLORS.length]);
  });
});

// ── colorBy='member' ──────────────────────────────────────────────────────────

describe('resolveActivityColor — colorBy=member', () => {
  it('returns the primary member color', () => {
    const member = makeMember('mem-1', '#00ff00');
    const act = makeActivity({ assignedMemberIds: ['mem-1'] });
    const result = resolveActivityColor(act, 0, { 'mem-1': member }, 'member', NO_STATUS_COLORS);
    expect(result).toBe('#00ff00');
  });

  it('falls back to activity.color when primary member is not in memberById', () => {
    const act = makeActivity({ assignedMemberIds: ['mem-missing'], color: '#123456' });
    expect(resolveActivityColor(act, 0, NO_MEMBERS, 'member', NO_STATUS_COLORS)).toBe('#123456');
  });

  it('falls back to ACTIVITY_COLORS index when member and activity.color are both absent', () => {
    const act = makeActivity({ assignedMemberIds: [], color: null as unknown as string });
    const result = resolveActivityColor(act, 1, NO_MEMBERS, 'member', NO_STATUS_COLORS);
    expect(result).toBe(ACTIVITY_COLORS[1 % ACTIVITY_COLORS.length]);
  });
});

// ── colorBy='status' ──────────────────────────────────────────────────────────

describe('resolveActivityColor — colorBy=status', () => {
  it('returns the status color from the map', () => {
    // reason: statusId is an optional field added by the API beyond the base type
    const act = makeActivity({ statusId: 'st-1' } as Partial<ApiActivity>);
    const statusColors = new Map([['st-1', '#9900ff']]);
    expect(resolveActivityColor(act, 0, NO_MEMBERS, 'status', statusColors)).toBe('#9900ff');
  });

  it('falls back to #6b7280 when status is not in the map', () => {
    const act = makeActivity();
    expect(resolveActivityColor(act, 0, NO_MEMBERS, 'status', NO_STATUS_COLORS)).toBe('#6b7280');
  });
});
