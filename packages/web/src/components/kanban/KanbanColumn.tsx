/**
 * KanbanColumn — a single droppable column with a header, card list, and "+ Add" affordance.
 *
 * Uses @dnd-kit useDroppable. When the column is non-droppable (combination/none grouping),
 * the drop-target is simply not registered and DnD events are ignored.
 */

import { useDroppable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { resolveColorHex } from '@/components/identity/identity-constants';
import KanbanCard from './KanbanCard';
import type { KanbanColumn as Column, KanbanCardField } from './kanbanColumns';
import type { Member } from '@/types';
import type { components } from '@draba/shared';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type Tag = components['schemas']['Tag'];

interface Props {
  column: Column;
  members: Member[];
  statusById: Map<string, Status>;
  tagById: Map<string, Tag>;
  /** Per-activity resolved hex color for card accent borders. */
  colorMap: Map<string, string>;
  cardFields: KanbanCardField[];
  suppressedFields: Set<KanbanCardField>;
  selectedActivityId: string | null;
  matchedIds: Set<string>;
  activeMatchId: string | null;
  hasQuery: boolean;
  isOver: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCardClick: (activity: ApiActivity) => void;
  onAddClick: () => void;
}

const COLUMN_WIDTH = 260;
const COLLAPSED_WIDTH = 40;

export default function KanbanColumn({
  column,
  members,
  statusById,
  tagById,
  colorMap,
  cardFields,
  suppressedFields,
  selectedActivityId,
  matchedIds,
  activeMatchId,
  hasQuery,
  isOver,
  isCollapsed,
  onToggleCollapse,
  onCardClick,
  onAddClick,
}: Props) {
  const { setNodeRef, isOver: dndIsOver } = useDroppable({
    id: column.id,
    disabled: !column.droppable,
    data: { columnId: column.id },
  });

  const accentColor = column.color
    ? (resolveColorHex(column.color) ?? column.color)
    : '#6b7280';

  const highlighted = isOver || dndIsOver;

  if (isCollapsed) {
    return (
      <div
        style={{
          width: COLLAPSED_WIDTH,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--muted)',
          borderRadius: 8,
          padding: '8px 0',
          cursor: 'pointer',
          border: '1px solid var(--border)',
          minHeight: 120,
          gap: 8,
        }}
        onClick={onToggleCollapse}
        title={`${column.label} (${column.items.length})`}
      >
        <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--muted-foreground)' }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            letterSpacing: '0.04em',
          }}
        >
          {column.label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--muted-foreground)',
            background: 'var(--border)',
            borderRadius: 9,
            padding: '1px 5px',
          }}
        >
          {column.items.length}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        width: COLUMN_WIDTH,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: highlighted ? `${accentColor}0d` : 'var(--muted)',
        border: `1px solid ${highlighted ? accentColor + '80' : 'var(--border)'}`,
        borderRadius: 8,
        transition: 'background 120ms, border-color 120ms',
        maxHeight: '100%',
      }}
    >
      {/* Column header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* Accent dot */}
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: accentColor,
            flexShrink: 0,
          }}
        />

        {/* Column label */}
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {column.label}
        </span>

        {/* Count badge */}
        <span
          style={{
            fontSize: 11,
            color: 'var(--muted-foreground)',
            background: 'var(--border)',
            borderRadius: 9,
            padding: '1px 6px',
            fontWeight: 600,
          }}
        >
          {column.items.length}
        </span>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          title="Collapse column"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronDown size={13} strokeWidth={2} />
        </button>
      </div>

      {/* Card list — scrolls independently */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 8px 4px',
          minHeight: 80,
        }}
      >
        {column.items.length === 0 ? (
          <div
            style={{
              padding: '12px 8px',
              fontSize: 12,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            No activities
          </div>
        ) : (
          column.items.map(act => (
            <KanbanCard
              key={act.id}
              activity={act}
              accentColor={colorMap.get(act.id) ?? accentColor}
              members={members}
              statusById={statusById}
              tagById={tagById}
              cardFields={cardFields}
              suppressedFields={suppressedFields}
              isSelected={selectedActivityId === act.id}
              dimmed={hasQuery && !matchedIds.has(act.id)}
              activeMatch={activeMatchId === act.id}
              onClick={() => onCardClick(act)}
            />
          ))
        )}
      </div>

      {/* + Add affordance */}
      <div style={{ padding: '4px 8px 8px', flexShrink: 0 }}>
        <button
          onClick={onAddClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            padding: '5px 8px',
            background: 'none',
            border: '1px dashed var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--muted-foreground)',
            transition: 'border-color 120ms, color 120ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = accentColor;
            e.currentTarget.style.color = accentColor;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--muted-foreground)';
          }}
        >
          <Plus size={12} strokeWidth={2} />
          Add
        </button>
      </div>
    </div>
  );
}
