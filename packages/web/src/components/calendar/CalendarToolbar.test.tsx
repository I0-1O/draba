/**
 * CalendarToolbar tests — behaviour-driven, no implementation coupling.
 *
 * CalendarGrid and CalendarView are not covered here: CalendarGrid depends on
 * pointer-event geometry that jsdom cannot simulate, and CalendarView requires
 * mocking several data-fetching hooks. Both are verified via manual UI
 * inspection on the Docker preview (see docs/TESTING.md §Manual).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalendarToolbar from './CalendarToolbar';

const ANCHOR = new Date('2026-06-01T00:00:00Z');

function renderToolbar(overrides: Partial<Parameters<typeof CalendarToolbar>[0]> = {}) {
  const props = {
    layout: 'month' as const,
    onLayoutChange: vi.fn(),
    anchorDate: ANCHOR,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
    colorBy: 'activity' as const,
    onColorByChange: vi.fn(),
    ...overrides,
  };
  render(<CalendarToolbar {...props} />);
  return props;
}

describe('CalendarToolbar', () => {
  it('renders Month and Week toggle buttons', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: 'Month' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Week' })).toBeTruthy();
  });

  it('calls onLayoutChange("week") when Week is clicked', async () => {
    const { onLayoutChange } = renderToolbar({ layout: 'month' });
    await userEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(onLayoutChange).toHaveBeenCalledWith('week');
  });

  it('calls onLayoutChange("month") when Month is clicked', async () => {
    const { onLayoutChange } = renderToolbar({ layout: 'week' });
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(onLayoutChange).toHaveBeenCalledWith('month');
  });

  it('calls onToday when Today is clicked', async () => {
    const { onToday } = renderToolbar();
    await userEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(onToday).toHaveBeenCalled();
  });

  it('calls onPrev when the left-chevron button is clicked', async () => {
    const { onPrev } = renderToolbar();
    await userEvent.click(screen.getByTitle('Previous'));
    expect(onPrev).toHaveBeenCalled();
  });

  it('calls onNext when the right-chevron button is clicked', async () => {
    const { onNext } = renderToolbar();
    await userEvent.click(screen.getByTitle('Next'));
    expect(onNext).toHaveBeenCalled();
  });

  it('displays the formatted month label for month layout', () => {
    renderToolbar({ layout: 'month', anchorDate: new Date('2026-06-01T00:00:00Z') });
    // Label format varies by locale; check that "June" and "2026" are present.
    const label = screen.getByText(/june.*2026/i);
    expect(label).toBeTruthy();
  });

  it('calls onColorByChange when the color-by select changes', async () => {
    const { onColorByChange } = renderToolbar();
    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, 'member');
    expect(onColorByChange).toHaveBeenCalledWith('member');
  });
});
