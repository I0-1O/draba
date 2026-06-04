/**
 * KanbanBoard — the DndContext host that owns all columns and the drag overlay.
 *
 * Renders columns in a horizontal scrolling row. On drag-end, derives the
 * correct PATCH payload for the active groupBy and calls onDrop.
 */

import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core';
import { useState } from 'react';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import type { KanbanColumn as Column, KanbanCardField, KanbanGroupBy } from './kanbanColumns';
import type { Member } from '@/types';
import type { components } from '@draba/shared';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type Tag = components['schemas']['Tag'];

export interface DropPayload {
  activityId: string;
  patch: {
    statusId?: string | null;
    assignedMemberIds?: string[];
    parentActivityId?: string | null;
  };
}

interface Props {
  columns: Column[];
  groupBy: KanbanGroupBy;
  members: Member[];
  statusById: Map<string, Status>;
  tagById: Map<string, Tag>;
  /** Per-activity resolved hex color for the card accent border. */
  colorMap: Map<string, string>;
  cardFields: KanbanCardField[];
  suppressedFields: Set<KanbanCardField>;
  selectedActivityId: string | null;
  matchedIds: Set<string>;
  activeMatchId: string | null;
  hasQuery: boolean;
  collapsedColumnIds: Set<string>;
  onToggleCollapse: (columnId: string) => void;
  onCardClick: (activity: ApiActivity) => void;
  onAddInColumn: (column: Column) => void;
  onDrop: (payload: DropPayload) => void;
  /** Map of activity ID → ApiActivity for drag overlay lookup. */
  activityById: Map<string, ApiActivity>;
  /** Map of activity ID → title, for showing parent names on child cards. */
  activityTitleById: Map<string, string>;
  // ── Hierarchy ────────────────────────────────────────────────────────────────
  showHierarchy: boolean;
  childrenByParentId: Map<string, ApiActivity[]>;
  collapsedParents: Set<string>;
  onToggleParent: (activityId: string) => void;
}

export default function KanbanBoard({
  columns,
  groupBy,
  members,
  statusById,
  tagById,
  colorMap,
  cardFields,
  suppressedFields,
  showHierarchy,
  childrenByParentId,
  collapsedParents,
  onToggleParent,
  selectedActivityId,
  matchedIds,
  activeMatchId,
  hasQuery,
  collapsedColumnIds,
  onToggleCollapse,
  onCardClick,
  onAddInColumn,
  onDrop,
  activityById,
  activityTitleById,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Require a 5px drag threshold to prevent accidental drags on card clicks.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    setOverColumnId(null);
    if (!over) return;

    const activityId = typeof active.id === 'string' ? active.id : String(active.id);
    const columnId = typeof over.id === 'string' ? over.id : String(over.id);

    const column = columns.find(c => c.id === columnId);
    if (!column || !column.droppable || !column.dropValue) return;

    // Determine if anything actually changed before issuing a PATCH.
    const activity = activityById.get(activityId);
    if (!activity) return;

    // Skip if the card is already in this column (no-op drop).
    const isAlreadyHere = (() => {
      switch (groupBy) {
        case 'status': {
          const currentStatus = (activity as ApiActivity & { statusId?: string | null }).statusId ?? null;
          return currentStatus === (column.dropValue.statusId ?? null);
        }
        case 'member': {
          const primary = activity.assignedMemberIds?.[0] ?? null;
          const target = column.dropValue.assignedMemberIds?.[0] ?? null;
          return primary === target;
        }
        default:
          return false;
      }
    })();

    if (isAlreadyHere) return;

    onDrop({ activityId, patch: column.dropValue });
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverColumnId(over ? String(over.id) : null);
  }

  const draggingActivity = draggingId ? activityById.get(draggingId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 12,
          padding: '12px 16px 16px',
          overflowX: 'auto',
          overflowY: 'hidden',
          height: '100%',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
        }}
      >
        {columns.map(col => (
          <KanbanColumn
            key={col.id}
            column={col}
            members={members}
            statusById={statusById}
            tagById={tagById}
            colorMap={colorMap}
            activityTitleById={activityTitleById}
            cardFields={cardFields}
            suppressedFields={suppressedFields}
            showHierarchy={showHierarchy}
            childrenByParentId={childrenByParentId}
            collapsedParents={collapsedParents}
            onToggleParent={onToggleParent}
            selectedActivityId={selectedActivityId}
            matchedIds={matchedIds}
            activeMatchId={activeMatchId}
            hasQuery={hasQuery}
            isOver={overColumnId === col.id && col.droppable}
            isCollapsed={collapsedColumnIds.has(col.id)}
            onToggleCollapse={() => onToggleCollapse(col.id)}
            onCardClick={onCardClick}
            onAddClick={() => onAddInColumn(col)}
          />
        ))}
      </div>

      {/* Drag overlay — floats above everything while dragging */}
      <DragOverlay dropAnimation={null}>
        {draggingActivity ? (
          <KanbanCard
            activity={draggingActivity}
            accentColor={colorMap.get(draggingActivity.id) ?? '#6b7280'}
            members={members}
            statusById={statusById}
            tagById={tagById}
            cardFields={cardFields}
            suppressedFields={suppressedFields}
            isSelected={false}
            dimmed={false}
            activeMatch={false}
            isDragOverlay
            onClick={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
