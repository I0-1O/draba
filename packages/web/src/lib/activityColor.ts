/**
 * Shared color-by resolution for calendar bars, Gantt bars, and list rows.
 * Extracted from GanttView.toRichActivity so all three views stay in sync.
 */

import type { ColorBy } from '@/components/gantt/GanttToolbar';
import type { Member } from '@/types';
import type { components } from '@draba/shared';
import { ACTIVITY_COLORS } from '@/types';

type ApiActivity = components['schemas']['Activity'];

/**
 * Resolve the display color for an activity based on the active color-by mode.
 *
 * @param activity     The API activity
 * @param index        Position in the activity list (used for cycling ACTIVITY_COLORS)
 * @param memberById   Map of member ID → Member (for member color lookup)
 * @param colorBy      Active color-by selection
 * @param statusColorById  Map of status ID → hex color (for status color lookup)
 */
export function resolveActivityColor(
  activity: ApiActivity,
  index: number,
  memberById: Record<string, Member>,
  colorBy: ColorBy,
  statusColorById: Map<string, string>,
): string {
  const assignedIds = activity.assignedMemberIds ?? [];
  const primaryMember = memberById[assignedIds[0] ?? ''];

  if (colorBy === 'member') {
    return primaryMember?.color ?? activity.color ?? ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
  }
  if (colorBy === 'status') {
    const statusId = (activity as ApiActivity & { statusId?: string | null }).statusId ?? '';
    return statusColorById.get(statusId) ?? '#6b7280';
  }
  // 'activity' (default)
  return activity.color ?? ACTIVITY_COLORS[index % ACTIVITY_COLORS.length];
}
