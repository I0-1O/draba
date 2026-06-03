/**
 * KanbanCard — a single draggable activity card.
 *
 * Renders the card accent border (driven by colorBy), title, and the
 * configured optional fields. Uses @dnd-kit useDraggable for drag support.
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, User } from 'lucide-react';
import { formatActivityDate } from '@/components/list/ListView';
import { resolveColorHex } from '@/components/identity/identity-constants';
import { Badge } from '@/components/identity/Badge';
import type { Member } from '@/types';
import type { components } from '@draba/shared';
import type { KanbanCardField } from './kanbanColumns';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type Tag = components['schemas']['Tag'];

interface Props {
  activity: ApiActivity;
  accentColor: string;
  members: Member[];
  statusById: Map<string, Status>;
  tagById: Map<string, Tag>;
  cardFields: KanbanCardField[];
  /** Fields suppressed because they duplicate the current Group by axis. */
  suppressedFields: Set<KanbanCardField>;
  isSelected: boolean;
  /** True when Find is active and this card doesn't match. */
  dimmed: boolean;
  /** True when Find is active and this card is the active match. */
  activeMatch: boolean;
  isDragOverlay?: boolean;
  onClick: () => void;
}

export default function KanbanCard({
  activity,
  accentColor,
  members,
  statusById,
  tagById,
  cardFields,
  suppressedFields,
  isSelected,
  dimmed,
  activeMatch,
  isDragOverlay = false,
  onClick,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: activity.id,
    data: { activityId: activity.id },
    // Drag overlay renders separately; don't set draggable on the overlay copy.
    disabled: isDragOverlay,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : dimmed ? 0.3 : 1,
    transition: dimmed ? 'opacity 150ms' : undefined,
  };

  const showField = (f: KanbanCardField) =>
    cardFields.includes(f) && !suppressedFields.has(f);

  const status = activity.statusId ? statusById.get(activity.statusId) : undefined;
  const statusColor = status?.color ? resolveColorHex(status.color) : undefined;

  const assignedMembers = (activity.assignedMemberIds ?? [])
    .map(id => members.find(m => m.id === id))
    .filter((m): m is Member => Boolean(m));

  const tags = (activity.tagIds ?? [])
    .map(id => tagById.get(id))
    .filter((t): t is Tag => Boolean(t));

  const formatDate = (iso: string | null | undefined) =>
    iso ? formatActivityDate(iso) : null;

  const startLabel = formatDate(activity.startAt);
  const endLabel   = formatDate(activity.endAt);
  const dateLabel  = startLabel && endLabel
    ? startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`
    : startLabel ?? endLabel ?? null;

  const cardStyle: React.CSSProperties = {
    ...style,
    background: 'var(--card)',
    border: `1px solid ${isSelected ? accentColor : activeMatch ? '#f59e0b' : 'var(--border)'}`,
    borderLeft: `3px solid ${accentColor}`,
    borderRadius: 6,
    padding: '8px 10px',
    cursor: isDragOverlay ? 'grabbing' : 'pointer',
    boxShadow: isDragOverlay
      ? '0 8px 24px rgba(0,0,0,0.2)'
      : isSelected
      ? `0 0 0 2px ${accentColor}40`
      : activeMatch
      ? '0 0 0 2px #f59e0b80'
      : undefined,
    userSelect: 'none',
    marginBottom: 6,
    transition: 'box-shadow 100ms, border-color 100ms',
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={cardStyle}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      {/* Title — always shown, 2-line clamp */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--foreground)',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginBottom: 4,
        }}
      >
        {activity.title}
      </div>

      {/* Description snippet */}
      {showField('description') && activity.description && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--muted-foreground)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
        >
          {activity.description}
        </div>
      )}

      {/* Status pill */}
      {showField('status') && status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: statusColor ?? '#6b7280',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{status.name}</span>
        </div>
      )}

      {/* Date range */}
      {showField('dateRange') && dateLabel && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--muted-foreground)',
            marginBottom: 4,
          }}
        >
          <Calendar size={11} strokeWidth={1.6} />
          {dateLabel}
        </div>
      )}

      {/* Tags */}
      {showField('tags') && tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
          {tags.slice(0, 3).map(t => (
            <span
              key={t.id}
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 10,
                background: resolveColorHex(t.color ?? null) ? `${resolveColorHex(t.color ?? null)}22` : 'var(--muted)',
                color: resolveColorHex(t.color ?? null) ?? 'var(--muted-foreground)',
                border: `1px solid ${resolveColorHex(t.color ?? null) ?? 'var(--border)'}44`,
              }}
            >
              {t.name}
            </span>
          ))}
          {tags.length > 3 && (
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>+{tags.length - 3}</span>
          )}
        </div>
      )}

      {/* % complete bar */}
      {showField('percentComplete') && activity.percentComplete != null && (
        <div style={{ marginBottom: 4 }}>
          <div
            style={{
              height: 3,
              background: 'var(--muted)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${activity.percentComplete}%`,
                background: accentColor,
                borderRadius: 2,
                transition: 'width 200ms',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer: parent pill + member avatars */}
      {(showField('parent') || showField('members')) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
          {/* Parent badge */}
          {showField('parent') && (activity as ApiActivity & { parentActivityId?: string | null }).parentActivityId && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--muted-foreground)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <User size={9} strokeWidth={1.6} />
              child
            </span>
          )}

          {/* Member avatars */}
          {showField('members') && assignedMembers.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginLeft: 'auto',
              }}
            >
              {assignedMembers.slice(0, 3).map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    marginLeft: i === 0 ? 0 : -6,
                    zIndex: assignedMembers.length - i,
                    outline: '2px solid var(--card)',
                    borderRadius: '50%',
                  }}
                  title={m.name}
                >
                  <Badge
                    identity={{ color: m.color, icon: '__name_2__' }}
                    name={m.name}
                    shape="circle"
                    size={20}
                  />
                </div>
              ))}
              {assignedMembers.length > 3 && (
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 4 }}>
                  +{assignedMembers.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
