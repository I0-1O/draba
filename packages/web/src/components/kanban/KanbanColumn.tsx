/**
 * KanbanColumn — a single droppable column with a header, card list, and "+ Add" affordance.
 *
 * Uses @dnd-kit useDroppable. When the column is non-droppable (combination/none grouping),
 * the drop-target is simply not registered and DnD events are ignored.
 *
 * Hierarchy: when showHierarchy is on, CardTree renders each root activity plus
 * its descendants indented beneath it. CardTree is defined at module level (outside
 * KanbanColumn) to give it a stable identity across re-renders — defining a component
 * inside another component causes React to unmount/remount the subtree on every render.
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

// ── CardTree ──────────────────────────────────────────────────────────────────

/**
 * Renders one activity card and, when hierarchy is on, its children indented
 * beneath it (recursively). Defined at module level so React gives it a stable
 * component identity and doesn't unmount/remount on every KanbanColumn render.
 */
interface CardTreeProps {
  activity: ApiActivity;
  depth: number;
  // Column rendering context
  accentColor: string;
  colorMap: Map<string, string>;
  members: Member[];
  statusById: Map<string, Status>;
  tagById: Map<string, Tag>;
  activityTitleById: Map<string, string>;
  cardFields: KanbanCardField[];
  suppressedFields: Set<KanbanCardField>;
  selectedActivityId: string | null;
  matchedIds: Set<string>;
  activeMatchId: string | null;
  hasQuery: boolean;
  onCardClick: (activity: ApiActivity) => void;
  // Hierarchy context
  showHierarchy: boolean;
  childrenByParentId: Map<string, ApiActivity[]>;
  collapsedParents: Set<string>;
  onToggleParent: (activityId: string) => void;
}

function CardTree({
  activity,
  depth,
  accentColor,
  colorMap,
  members,
  statusById,
  tagById,
  activityTitleById,
  cardFields,
  suppressedFields,
  selectedActivityId,
  matchedIds,
  activeMatchId,
  hasQuery,
  onCardClick,
  showHierarchy,
  childrenByParentId,
  collapsedParents,
  onToggleParent,
}: CardTreeProps) {
  const children = showHierarchy ? (childrenByParentId.get(activity.id) ?? []) : [];
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedParents.has(activity.id);
  const indentPx = Math.min(depth, 2) * 16;

  const cardTreeProps = {
    accentColor,
    colorMap,
    members,
    statusById,
    tagById,
    activityTitleById,
    cardFields,
    suppressedFields,
    selectedActivityId,
    matchedIds,
    activeMatchId,
    hasQuery,
    onCardClick,
    showHierarchy,
    childrenByParentId,
    collapsedParents,
    onToggleParent,
  };

  return (
    <>
      <div style={depth > 0 ? { paddingLeft: indentPx } : undefined}>
        <KanbanCard
          activity={activity}
          accentColor={colorMap.get(activity.id) ?? accentColor}
          members={members}
          statusById={statusById}
          tagById={tagById}
          activityTitleById={activityTitleById}
          cardFields={cardFields}
          suppressedFields={suppressedFields}
          isSelected={selectedActivityId === activity.id}
          dimmed={hasQuery && !matchedIds.has(activity.id)}
          activeMatch={activeMatchId === activity.id}
          isChildCard={depth > 0}
          hasHierarchyChildren={hasChildren}
          isHierarchyCollapsed={isCollapsed}
          onToggleHierarchy={() => onToggleParent(activity.id)}
          onClick={() => onCardClick(activity)}
        />
      </div>
      {hasChildren && !isCollapsed && children.map(child => (
        <CardTree
          key={child.id}
          activity={child}
          depth={depth + 1}
          {...cardTreeProps}
        />
      ))}
    </>
  );
}

interface Props {
  column: Column;
  members: Member[];
  statusById: Map<string, Status>;
  tagById: Map<string, Tag>;
  /** Per-activity resolved hex color for card accent borders. */
  colorMap: Map<string, string>;
  /** Activity ID → title, for showing the parent name on child cards. */
  activityTitleById: Map<string, string>;
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
  // ── Hierarchy ────────────────────────────────────────────────────────────────
  showHierarchy: boolean;
  /** Maps parentActivityId → direct child activities. */
  childrenByParentId: Map<string, ApiActivity[]>;
  /** Set of parent activity IDs whose children are hidden. */
  collapsedParents: Set<string>;
  onToggleParent: (activityId: string) => void;
}

const COLUMN_WIDTH = 260;
const COLLAPSED_WIDTH = 40;

export default function KanbanColumn({
  column,
  members,
  statusById,
  tagById,
  colorMap,
  activityTitleById,
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
  showHierarchy,
  childrenByParentId,
  collapsedParents,
  onToggleParent,
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

  // Shared props forwarded to each CardTree node.
  const treeProps = {
    accentColor,
    colorMap,
    members,
    statusById,
    tagById,
    activityTitleById,
    cardFields,
    suppressedFields,
    selectedActivityId,
    matchedIds,
    activeMatchId,
    hasQuery,
    onCardClick,
    showHierarchy,
    childrenByParentId,
    collapsedParents,
    onToggleParent,
  };

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
            <CardTree
              key={act.id}
              activity={act}
              depth={0}
              {...treeProps}
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
