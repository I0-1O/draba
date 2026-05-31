/**
 * ListView — inline-editable, curated table view of the active timeline's
 * activities.
 *
 * Uses TanStack Table v8 for column management (visibility, order, sizing,
 * pinning, sorting). Row rendering is manual to support group-by headers
 * interleaved between activity rows and to give full control over
 * keyboard selection/edit behavior.
 *
 * Integrates with FilterContext and FindContext so the same filter and find
 * query that drives the Gantt view also drives this view.
 */

import { createPortal } from 'react-dom';
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type VisibilityState,
  type ColumnSizingState,
  type ColumnPinningState,
} from '@tanstack/react-table';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, ChevronDown, GripVertical, Search, Trash2 } from 'lucide-react';
import { useTimelineActivities, useTeamMembers, useUpdateActivity, useCreateActivity, useDeleteActivity } from '@/hooks/useTeamActivities';
import { usePreferenceMap, useUpsertPreference, usePreferences } from '@/hooks/usePreferences';
import { useFilter } from '@/contexts/FilterContext';
import { useFind } from '@/contexts/FindContext';
import { applyActiveFilter } from '@/lib/presetFilters';
import { matchEvents } from '@/lib/findMatcher';
import { resolveColorHex } from '@/components/identity/identity-constants';
import { Badge } from '@/components/identity/Badge';
import { IdentityPicker } from '@/components/identity/IdentityPicker';
import type { Identity } from '@/components/identity/identity-constants';
import TagInput from '@/components/TagInput';
import type { components } from '@draba/shared';
import type { Member } from '@/types';
import type { ListGroupBy, ListSortBy, ListColorBy, ColumnConfig } from './ListToolbar';

type ApiActivity = components['schemas']['Activity'];
type Status = components['schemas']['Status'];
type SavedFilter = components['schemas']['SavedFilter'];
type Tag = components['schemas']['Tag'];
type TeamMemberWithUser = components['schemas']['TeamMemberWithUser'];

// ── Column catalog ─────────────────────────────────────────────────────────────

interface ColMeta {
  id: string;
  label: string;
  defaultVisible: boolean;
  defaultWidth: number;
  editable: boolean;
  editType: 'text' | 'date' | 'status' | 'number' | 'identity' | 'assignees' | 'tags' | 'parent' | 'none';
  /** Exclude from the columns toggle menu (e.g. fixed structural columns). */
  noMenu?: boolean;
}

const COL_CATALOG: ColMeta[] = [
  { id: 'colorBar',    label: '',             defaultVisible: true,  defaultWidth: 24,  editable: false, editType: 'none', noMenu: true },
  { id: 'identity',    label: 'Identity',     defaultVisible: true,  defaultWidth: 52,  editable: true,  editType: 'identity' },
  { id: 'title',       label: 'Title',        defaultVisible: true,  defaultWidth: 280, editable: true,  editType: 'text' },
  { id: 'startAt',     label: 'Start',        defaultVisible: true,  defaultWidth: 110, editable: true,  editType: 'date' },
  { id: 'endAt',       label: 'End',          defaultVisible: true,  defaultWidth: 110, editable: true,  editType: 'date' },
  { id: 'duration',    label: 'Duration',     defaultVisible: true,  defaultWidth: 90,  editable: false, editType: 'none' },
  { id: 'status',      label: 'Status',       defaultVisible: true,  defaultWidth: 130, editable: true,  editType: 'status' },
  { id: 'assignees',   label: 'Assigned To',  defaultVisible: true,  defaultWidth: 140, editable: true,  editType: 'assignees' },
  { id: 'tags',        label: 'Tags',         defaultVisible: true,  defaultWidth: 130, editable: true,  editType: 'tags' },
  { id: 'progress',    label: 'Progress',     defaultVisible: false, defaultWidth: 90,  editable: true,  editType: 'number' },
  { id: 'parent',      label: 'Parent',       defaultVisible: false, defaultWidth: 150, editable: true,  editType: 'parent' },
  { id: 'description', label: 'Description',  defaultVisible: false, defaultWidth: 200, editable: true,  editType: 'text' },
  { id: 'location',    label: 'Location',     defaultVisible: false, defaultWidth: 130, editable: true,  editType: 'text' },
  { id: 'url',         label: 'URL',          defaultVisible: false, defaultWidth: 150, editable: true,  editType: 'text' },
  { id: 'notes',       label: 'Notes',        defaultVisible: false, defaultWidth: 200, editable: true,  editType: 'text' },
  { id: 'createdAt',   label: 'Created',      defaultVisible: false, defaultWidth: 110, editable: false, editType: 'none' },
  { id: 'updatedAt',   label: 'Updated',      defaultVisible: false, defaultWidth: 110, editable: false, editType: 'none' },
];

const DEFAULT_COLUMN_ORDER = COL_CATALOG.map(c => c.id);
const DEFAULT_VISIBILITY: VisibilityState = Object.fromEntries(
  COL_CATALOG.map(c => [c.id, c.defaultVisible]),
);
const DEFAULT_WIDTHS: ColumnSizingState = Object.fromEntries(
  COL_CATALOG.map(c => [c.id, c.defaultWidth]),
);

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  teamId: string;
  timelineId: string;
  groupBy: ListGroupBy;
  sortBy: ListSortBy;
  colorBy: ListColorBy;
  density?: string; // kept for compat; ignored — always comfortable
  timelineStatuses?: Status[];
  savedFilters?: SavedFilter[];
  tags?: Tag[];
  onColumnsChange?: (configs: ColumnConfig[]) => void;
  /** When set, the component applies the toggle and clears it on the next render. */
  pendingColumnToggle?: { colId: string; visible: boolean; seq: number } | null;
  onSelectActivity?: (id: string | null) => void;
  onSelectApiActivity?: (a: ApiActivity | null) => void;
  selectedActivityId?: string | null;
  onMembersLoaded?: (members: Member[]) => void;
  /** Increment to trigger inline creation of a new activity row. */
  triggerNewRow?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(startAt: string | null | undefined, endAt: string | null | undefined): string {
  if (!startAt || !endAt) return '—';
  const start = new Date(startAt);
  const end = new Date(endAt);
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return '—';
  if (days === 0) return '1 day';
  return `${days + 1} days`;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

// ── Draggable column header ────────────────────────────────────────────────────

function SortableColHeader({ colId, children, style, onSort, sortDir, resizeHandler, isResizing }: {
  colId: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onSort?: () => void;
  sortDir?: 'asc' | 'desc' | false;
  resizeHandler?: (e: React.MouseEvent | React.TouchEvent) => void;
  isResizing?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: colId });

  return (
    <th
      ref={setNodeRef}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'sticky',
        top: 0,
        background: 'var(--card)',
        borderBottom: '2px solid var(--border)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        cursor: onSort ? 'pointer' : 'default',
        fontWeight: 600,
        fontSize: 11,
        color: 'var(--muted-foreground)',
        padding: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: 'left',
        overflow: 'visible', // needed for resize handle
      }}
      onClick={onSort}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px', overflow: 'hidden' }}>
        {/* drag handle */}
        <span
          {...attributes}
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--muted-foreground)', opacity: 0.4, flexShrink: 0, paddingRight: 2 }}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical size={12} />
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
        {sortDir === 'asc' && <span style={{ opacity: 0.7, flexShrink: 0 }}>↑</span>}
        {sortDir === 'desc' && <span style={{ opacity: 0.7, flexShrink: 0 }}>↓</span>}
      </div>
      {/* Resize handle — absolutely positioned on right edge */}
      {resizeHandler && (
        <div
          onMouseDown={resizeHandler}
          onTouchStart={resizeHandler}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            height: '100%',
            width: 4,
            cursor: 'col-resize',
            background: isResizing ? 'var(--primary)' : 'transparent',
            zIndex: 1,
          }}
          onMouseEnter={e => { if (!isResizing) (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
          onMouseLeave={e => { if (!isResizing) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        />
      )}
    </th>
  );
}

// ── Status pill popover ────────────────────────────────────────────────────────

function StatusPicker({
  value,
  statuses,
  onChange,
  onClose,
  positionStyle,
}: {
  value: string | null | undefined;
  statuses: Status[];
  onChange: (id: string | null) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        ...positionStyle,
        zIndex: 1000,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: 160,
        padding: '6px 0',
      }}
    >
      <div
        onClick={() => { onChange(null); onClose(); }}
        style={{
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        No status
      </div>
      {statuses.map(s => (
        <div
          key={s.id}
          onClick={() => { onChange(s.id); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--foreground)',
            background: value === s.id ? 'var(--muted)' : 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = value === s.id ? 'var(--muted)' : 'transparent')}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: resolveColorHex(s.color ?? null) ?? '#888',
              flexShrink: 0,
            }}
          />
          {s.name}
        </div>
      ))}
    </div>
  );
}

// ── Assignee picker popover ────────────────────────────────────────────────────

function AssigneePicker({
  members,
  selectedIds,
  onToggle,
  onClose,
  positionStyle,
}: {
  members: Member[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        ...positionStyle,
        zIndex: 1000,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: 180,
        padding: '6px 0',
      }}
    >
      {members.length === 0 && (
        <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--muted-foreground)' }}>
          No team members
        </div>
      )}
      {members.map(m => {
        const assigned = selectedIds.includes(m.id);
        return (
          <div
            key={m.id}
            onClick={() => onToggle(m.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', cursor: 'pointer', fontSize: 12,
              background: assigned ? 'var(--muted)' : 'transparent',
              color: 'var(--foreground)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = assigned ? 'var(--muted)' : 'transparent')}
          >
            <Badge
              identity={{ color: m.color, icon: '__name_2__' }}
              name={m.name}
              shape="circle"
              size={20}
            />
            <span style={{ flex: 1 }}>{m.name}</span>
            {assigned && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: m.color, flexShrink: 0, display: 'inline-block',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tag picker popover ─────────────────────────────────────────────────────────

function TagPicker({
  teamId,
  tags,
  selectedTagIds,
  onChange,
  onClose,
  positionStyle,
}: {
  teamId: string;
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        ...positionStyle,
        zIndex: 1000,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: 220,
        padding: 8,
      }}
    >
      <TagInput teamId={teamId} tags={tags} selectedTagIds={selectedTagIds} onChange={onChange} />
    </div>
  );
}

// ── Parent activity picker popover ─────────────────────────────────────────────

function ParentPicker({
  activities,
  value,
  onChange,
  onClose,
  positionStyle,
}: {
  activities: ApiActivity[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  onClose: () => void;
  positionStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseRef.current();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = activities.filter(a =>
    a.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function choose(id: string | null) {
    onChange(id);
    onClose();
  }

  return (
    <div
      ref={ref}
      style={{
        ...positionStyle,
        zIndex: 1000,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: 220,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 8px', borderBottom: '1px solid var(--border)',
      }}>
        <Search size={12} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--muted-foreground)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search activities…"
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'none',
            fontSize: 12, color: 'var(--foreground)', fontFamily: 'var(--font-sans)',
          }}
        />
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        <div
          onClick={() => choose(null)}
          style={{
            padding: '6px 10px', fontSize: 12, color: 'var(--muted-foreground)',
            fontStyle: 'italic', cursor: 'pointer',
            borderBottom: filtered.length > 0 ? '1px solid var(--border)' : 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          — None —
        </div>
        {filtered.map(a => (
          <div
            key={a.id}
            onClick={() => choose(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', fontSize: 12, cursor: 'pointer',
              background: a.id === value ? 'var(--muted)' : 'transparent',
              fontWeight: a.id === value ? 600 : 400,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = a.id === value ? 'var(--muted)' : 'transparent')}
          >
            <Badge
              identity={{ color: a.color ?? '#288C9B', icon: a.icon ?? '__none__' }}
              name={a.title}
              size={16}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.title}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
            No matching activities
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Position a popover below a cell, flipping above if there isn't enough space below. */
function popoverPos(rect: DOMRect, w: number, h: number): { top: number; left: number } {
  const spaceBelow = window.innerHeight - rect.bottom - 2;
  const top = spaceBelow >= h
    ? rect.bottom + 2
    : Math.max(4, rect.top - h - 2);
  return {
    top,
    left: Math.min(rect.left, window.innerWidth - w - 8),
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ListView({
  teamId,
  timelineId,
  groupBy,
  sortBy,
  colorBy,
  timelineStatuses = [],
  savedFilters = [],
  tags = [],
  onColumnsChange,
  pendingColumnToggle,
  onSelectActivity,
  selectedActivityId,
  onMembersLoaded,
  triggerNewRow,
}: Props) {
  const { activeFilter } = useFilter();
  const { debouncedQuery, registerMatches, matchedIds, activeMatchId } = useFind();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: rawActivities = [] } = useTimelineActivities(teamId, timelineId);
  const { data: rawMembers = [] } = useTeamMembers(teamId);
  const update = useUpdateActivity(timelineId);
  const create = useCreateActivity(teamId, timelineId);
  const deleteAct = useDeleteActivity(timelineId);

  useEffect(() => {
    if (rawMembers.length > 0 && onMembersLoaded) {
      onMembersLoaded(rawMembers.map(m => ({
        id: m.id,
        name: m.displayName,
        initials: m.displayName.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase(),
        color: resolveColorHex(m.color ?? null) ?? '#888',
      })));
    }
  }, [rawMembers, onMembersLoaded]);

  function initialsFrom(name: string): string {
    return name.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  }

  const members: Member[] = useMemo(
    () => rawMembers.map(m => ({
      id: m.id,
      name: m.displayName,
      initials: initialsFrom(m.displayName),
      color: resolveColorHex(m.color ?? null) ?? '#888',
    })),
    [rawMembers],
  );

  // ── Preference persistence ────────────────────────────────────────────────
  const { isSuccess: prefsSettled } = usePreferences(timelineId);
  const prefMap = usePreferenceMap(timelineId);
  const upsert = useUpsertPreference();
  const prefsApplied = useRef(false);

  // Column state (managed by TanStack Table)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(DEFAULT_COLUMN_ORDER);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(DEFAULT_WIDTHS);
  const [sorting, setSorting] = useState<SortingState>([]);

  // Apply saved column prefs once after they load
  useEffect(() => {
    if (!prefsSettled || prefsApplied.current) return;
    prefsApplied.current = true;
    const raw = prefMap['list_columns'];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const config = raw as { order?: string[]; hidden?: string[]; widths?: Record<string, number> };
      if (Array.isArray(config.order) && config.order.length > 0) {
        const saved = config.order as string[];
        const allIds = COL_CATALOG.map(c => c.id);
        const newCols = allIds.filter(id => !saved.includes(id));
        setColumnOrder([...saved, ...newCols]);
      }
      if (Array.isArray(config.hidden)) {
        const vis: VisibilityState = { ...DEFAULT_VISIBILITY };
        for (const id of config.hidden as string[]) {
          if (id in vis) vis[id] = false;
        }
        setColumnVisibility(vis);
      }
      if (config.widths && typeof config.widths === 'object') {
        setColumnSizing(prev => ({ ...prev, ...config.widths }));
      }
    }
  }, [prefsSettled, prefMap]);

  // Persist column config on change (debounced via a ref guard)
  const saveCols = useCallback(
    (vis: VisibilityState, order: ColumnOrderState, sizing: ColumnSizingState) => {
      if (!timelineId) return;
      const hidden = Object.entries(vis).filter(([, v]) => !v).map(([k]) => k);
      const config = { order, hidden, widths: sizing };
      upsert.mutate({ key: 'list_columns', value: JSON.stringify(config), timelineId });
    },
    [timelineId, upsert.mutate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveCols = useCallback(
    (vis: VisibilityState, order: ColumnOrderState, sizing: ColumnSizingState) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveCols(vis, order, sizing), 400);
    },
    [saveCols],
  );

  const handleVisibilityChange = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      setColumnVisibility(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (prefsApplied.current) debouncedSaveCols(next, columnOrder, columnSizing);
        return next;
      });
    },
    [columnOrder, columnSizing, debouncedSaveCols],
  );

  const handleOrderChange = useCallback(
    (updater: ColumnOrderState | ((prev: ColumnOrderState) => ColumnOrderState)) => {
      setColumnOrder(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (prefsApplied.current) debouncedSaveCols(columnVisibility, next, columnSizing);
        return next;
      });
    },
    [columnVisibility, columnSizing, debouncedSaveCols],
  );

  const handleSizingChange = useCallback(
    (updater: ColumnSizingState | ((prev: ColumnSizingState) => ColumnSizingState)) => {
      setColumnSizing(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (prefsApplied.current) debouncedSaveCols(columnVisibility, columnOrder, next);
        return next;
      });
    },
    [columnVisibility, columnOrder, debouncedSaveCols],
  );

  // ── TanStack Table ─────────────────────────────────────────────────────────

  const columnDefs = useMemo<ColumnDef<ApiActivity>[]>(
    () =>
      COL_CATALOG.map(meta => ({
        id: meta.id,
        header: meta.label,
        size: DEFAULT_WIDTHS[meta.id] ?? 120,
        minSize: 40,
        maxSize: 800,
        enableResizing: true,
        enableSorting: meta.editType !== 'none' || meta.id === 'duration',
      })),
    [],
  );

  const table = useReactTable({
    data: rawActivities,
    columns: columnDefs,
    state: {
      columnVisibility,
      columnOrder,
      columnSizing,
      columnPinning: { left: ['colorBar', 'identity', 'title'] } as ColumnPinningState,
      sorting,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: handleVisibilityChange,
    onColumnOrderChange: handleOrderChange,
    onColumnSizingChange: handleSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });

  // Apply external column toggle from the toolbar (via DashboardPage)
  const lastAppliedSeq = useRef<number | null>(null);
  useEffect(() => {
    if (!pendingColumnToggle) return;
    if (pendingColumnToggle.seq === lastAppliedSeq.current) return;
    lastAppliedSeq.current = pendingColumnToggle.seq;
    setColumnVisibility(prev => {
      const next = { ...prev, [pendingColumnToggle.colId]: pendingColumnToggle.visible };
      if (prefsApplied.current) debouncedSaveCols(next, columnOrder, columnSizing);
      return next;
    });
  }, [pendingColumnToggle, columnOrder, columnSizing, debouncedSaveCols]);

  // Expose ALL column configs (visible + hidden) to toolbar via callback.
  // Uses a ref-based equality check to avoid calling onColumnsChange (which
  // typically calls setListColumns in DashboardPage) with a new array reference
  // every render — that would create an infinite setState→re-render loop.
  const lastColConfigsRef = useRef<ColumnConfig[] | null>(null);
  useEffect(() => {
    if (!onColumnsChange) return;
    const configs: ColumnConfig[] = table.getAllLeafColumns()
      .filter(col => !COL_CATALOG.find(c => c.id === col.id)?.noMenu)
      .map(col => ({
        id: col.id,
        label: COL_CATALOG.find(c => c.id === col.id)?.label ?? col.id,
        visible: col.getIsVisible(),
      }));
    const prev = lastColConfigsRef.current;
    const changed = !prev || prev.length !== configs.length ||
      prev.some((c, i) => c.id !== configs[i].id || c.visible !== configs[i].visible || c.label !== configs[i].label);
    if (changed) {
      lastColConfigsRef.current = configs;
      onColumnsChange(configs);
    }
  }); // runs every render so order/visibility changes propagate immediately

  // ── Filter + sort ──────────────────────────────────────────────────────────

  const memberIdsByUserId = useMemo<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>();
    for (const m of rawMembers) {
      if (!m.userId) continue;
      const list = map.get(m.userId) ?? [];
      list.push(m.id);
      map.set(m.userId, list);
    }
    return map;
  }, [rawMembers]);

  const closedStatusIds = useMemo(
    () => new Set(timelineStatuses.filter(s => s.isClosed).map(s => s.id)),
    [timelineStatuses],
  );

  const statusesByTimeline = useMemo(() => {
    const m = new Map<string, Status[]>();
    m.set(timelineId, timelineStatuses);
    return m;
  }, [timelineId, timelineStatuses]);

  const filteredActivities = useMemo(
    () =>
      applyActiveFilter(rawActivities, activeFilter, memberIdsByUserId, {
        closedStatusIds,
        savedFilters,
        statuses: statusesByTimeline,
        tags,
      }),
    [rawActivities, activeFilter, memberIdsByUserId, closedStatusIds, savedFilters, statusesByTimeline, tags],
  );

  // Apply TanStack sorting
  const sortedActivities = useMemo(() => {
    const acts = [...filteredActivities];
    const col = sorting[0];
    if (!col) {
      return acts.sort((a, b) => {
        if (sortBy === 'startDate') return (a.startAt ?? '').localeCompare(b.startAt ?? '');
        if (sortBy === 'endDate') return (a.endAt ?? '').localeCompare(b.endAt ?? '');
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'status') return (a.statusId ?? '').localeCompare(b.statusId ?? '');
        if (sortBy === 'progress') return (b.percentComplete ?? 0) - (a.percentComplete ?? 0);
        return 0;
      });
    }
    return acts.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (col.id) {
        case 'title': av = a.title; bv = b.title; break;
        case 'startAt': av = a.startAt ?? ''; bv = b.startAt ?? ''; break;
        case 'endAt': av = a.endAt ?? ''; bv = b.endAt ?? ''; break;
        case 'status': av = a.statusId ?? ''; bv = b.statusId ?? ''; break;
        case 'progress': av = a.percentComplete ?? 0; bv = b.percentComplete ?? 0; break;
        default: av = a.title; bv = b.title;
      }
      const cmp = typeof av === 'number' ? av - (bv as number) : (av as string).localeCompare(bv as string);
      return col.desc ? -cmp : cmp;
    });
  }, [filteredActivities, sorting, sortBy]);

  // ── Group-by ───────────────────────────────────────────────────────────────

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const memberById = useMemo<Map<string, TeamMemberWithUser>>(
    () => new Map(rawMembers.map(m => [m.id, m])),
    [rawMembers],
  );
  const statusById = useMemo<Map<string, Status>>(
    () => new Map(timelineStatuses.map(s => [s.id, s])),
    [timelineStatuses],
  );
  const activityById = useMemo<Map<string, ApiActivity>>(
    () => new Map(rawActivities.map(a => [a.id, a])),
    [rawActivities],
  );

  type DisplayRow =
    | { kind: 'group'; key: string; label: string; count: number }
    | { kind: 'activity'; activity: ApiActivity; depth: number; hasChildren: boolean; groupKey: string };

  const displayRows = useMemo<DisplayRow[]>(() => {
    const emptyRow = (a: ApiActivity): DisplayRow => ({
      kind: 'activity', activity: a, depth: 0, hasChildren: false, groupKey: '',
    });

    if (groupBy === 'none') {
      return sortedActivities.map(emptyRow);
    }

    if (groupBy === 'member') {
      const groups = new Map<string, { label: string; activities: ApiActivity[] }>();
      for (const activity of sortedActivities) {
        const ids = activity.assignedMemberIds ?? [];
        const key = ids.length === 0 ? '__unassigned__' : ids[0];
        const label = ids.length === 0 ? 'Unassigned' : (memberById.get(ids[0])?.displayName ?? 'Unknown');
        const group = groups.get(key) ?? { label, activities: [] };
        group.activities.push(activity);
        groups.set(key, group);
      }
      const rows: DisplayRow[] = [];
      for (const [key, { label, activities }] of groups) {
        rows.push({ kind: 'group', key, label, count: activities.length });
        if (!collapsedGroups.has(key)) {
          for (const a of activities) rows.push({ kind: 'activity', activity: a, depth: 0, hasChildren: false, groupKey: key });
        }
      }
      return rows;
    }

    if (groupBy === 'status') {
      const groups = new Map<string, { label: string; activities: ApiActivity[] }>();
      for (const activity of sortedActivities) {
        const key = activity.statusId ?? '__no_status__';
        const label = activity.statusId ? (statusById.get(activity.statusId)?.name ?? 'Unknown') : 'No status';
        const group = groups.get(key) ?? { label, activities: [] };
        group.activities.push(activity);
        groups.set(key, group);
      }
      // Emit statuses in order, then no-status
      const rows: DisplayRow[] = [];
      for (const s of timelineStatuses) {
        const group = groups.get(s.id);
        if (!group?.activities.length) continue;
        rows.push({ kind: 'group', key: s.id, label: s.name, count: group.activities.length });
        if (!collapsedGroups.has(s.id)) {
          for (const a of group.activities) rows.push({ kind: 'activity', activity: a, depth: 0, hasChildren: false, groupKey: s.id });
        }
      }
      const noStatus = groups.get('__no_status__');
      if (noStatus?.activities.length) {
        rows.push({ kind: 'group', key: '__no_status__', label: 'No status', count: noStatus.activities.length });
        if (!collapsedGroups.has('__no_status__')) {
          for (const a of noStatus.activities) rows.push({ kind: 'activity', activity: a, depth: 0, hasChildren: false, groupKey: '__no_status__' });
        }
      }
      return rows;
    }

    if (groupBy === 'parent') {
      // Build tree like Gantt: parent activity rows are collapsible, children are indented
      const byId = new Map(sortedActivities.map(a => [a.id, a]));
      const childrenByParent = new Map<string, ApiActivity[]>();
      const roots: ApiActivity[] = [];

      for (const a of sortedActivities) {
        if (a.parentActivityId && byId.has(a.parentActivityId)) {
          const list = childrenByParent.get(a.parentActivityId) ?? [];
          list.push(a);
          childrenByParent.set(a.parentActivityId, list);
        } else {
          roots.push(a);
        }
      }

      const rows: DisplayRow[] = [];
      const seen = new Set<string>();
      const hidden = new Set<string>();

      const markHidden = (a: ApiActivity) => {
        if (hidden.has(a.id)) return;
        hidden.add(a.id);
        for (const k of childrenByParent.get(a.id) ?? []) markHidden(k);
      };

      const visit = (a: ApiActivity, depth: number) => {
        if (seen.has(a.id)) return;
        seen.add(a.id);
        const kids = childrenByParent.get(a.id) ?? [];
        const hasChildren = kids.length > 0;
        const isCollapsed = collapsedGroups.has(a.id);
        rows.push({ kind: 'activity', activity: a, depth, hasChildren, groupKey: a.id });
        if (!hasChildren) return;
        if (isCollapsed) for (const k of kids) markHidden(k);
        else for (const k of kids) visit(k, depth + 1);
      };

      for (const r of roots) visit(r, 0);
      for (const a of sortedActivities) {
        if (!seen.has(a.id) && !hidden.has(a.id)) visit(a, 0);
      }
      return rows;
    }

    return sortedActivities.map(emptyRow);
  }, [sortedActivities, groupBy, memberById, statusById, activityById, timelineStatuses, collapsedGroups]);

  // Flat list of activity rows (for keyboard navigation indices)
  const activityRows = useMemo(
    () => displayRows.filter((r): r is Extract<DisplayRow, { kind: 'activity' }> => r.kind === 'activity'),
    [displayRows],
  );

  // ── Find integration ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!debouncedQuery) {
      registerMatches([], new Map());
      return;
    }
    const results = matchEvents(debouncedQuery, filteredActivities, members, rawActivities);
    const ids = results.map(r => r.activityId);
    const reasons = new Map(results.map(r => [r.activityId, r.reasons]));
    registerMatches(ids, reasons);
  }, [debouncedQuery, filteredActivities, members, rawActivities, registerMatches]);

  // Auto-scroll to active match
  const activeRowRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    if (activeMatchId && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeMatchId]);

  // ── Selection & editing state ──────────────────────────────────────────────

  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [selectedColIdx, setSelectedColIdx] = useState<number>(0);
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colIdx: number;
    value: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When a new activity is selected externally, sync row idx
  useEffect(() => {
    if (!selectedActivityId) { setSelectedRowIdx(null); return; }
    const idx = activityRows.findIndex(r => r.activity.id === selectedActivityId);
    if (idx >= 0) setSelectedRowIdx(idx);
  }, [selectedActivityId, activityRows]);

  useEffect(() => {
    if (!editingCell || !editInputRef.current) return;
    const inp = editInputRef.current;
    inp.focus();
    inp.scrollIntoView({ block: 'nearest' });
    const colId = visibleColIds[editingCell.colIdx];
    const meta = COL_CATALOG.find(c => c.id === colId);
    if (meta?.editType === 'date') {
      // showPicker() opens the calendar immediately. Deferred so the browser
      // has processed the focus event first. Only one date input is ever in
      // the DOM at a time (single-cell editing), so no range-picker pairing.
      setTimeout(() => {
        try { (inp as HTMLInputElement & { showPicker?(): void }).showPicker?.(); } catch { /* not all browsers */ }
      }, 0);
    } else {
      inp.select();
    }
  }, [editingCell]); // visibleColIds intentionally excluded — always current in this render cycle

  // Visible column ids, in the SAME order the cells are rendered.
  //
  // Cells render from `table.getHeaderGroups()`, which moves pinned-left
  // columns (colorBar, identity, title) to the front. `getVisibleLeafColumns()`
  // does NOT apply pinning — it follows raw `columnOrder`. When a persisted
  // `columnOrder` doesn't place the pinned columns first (e.g. a saved order
  // from before `colorBar`/`identity` existed appends them at the end), the two
  // orderings diverge and every colIdx→colId lookup (enterEdit, commitEdit,
  // showPicker, keyboard nav) targets the wrong column. Deriving from the
  // header groups keeps colIdx aligned with what the user actually clicked.
  const visibleColIds = useMemo(
    () => (table.getHeaderGroups()[0]?.headers ?? []).map(h => h.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnOrder, columnVisibility],
  );

  const commitEdit = useCallback(
    (rowIdx: number, colId: string, value: string) => {
      const row = activityRows[rowIdx];
      if (!row) return;
      const a = row.activity;

      const patch: Partial<ApiActivity> & { notes?: string | null } = {};
      if (colId === 'title' && value.trim() !== '') patch.title = value.trim();
      else if (colId === 'startAt') patch.startAt = value ? `${value}T00:00:00Z` : undefined;
      else if (colId === 'endAt') patch.endAt = value ? `${value}T00:00:00Z` : undefined;
      else if (colId === 'description') patch.description = value || undefined;
      else if (colId === 'location') patch.location = value || undefined;
      else if (colId === 'url') patch.url = value || undefined;
      else if (colId === 'notes') patch.notes = value || undefined;
      else if (colId === 'progress') {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0 && n <= 100) patch.percentComplete = n;
      }

      if (Object.keys(patch).length > 0) {
        update.mutate({ activityId: a.id, patch });
      }
    },
    [activityRows, update],
  );

  const enterEdit = useCallback((rowIdx: number, colIdx: number) => {
    const row = activityRows[rowIdx];
    if (!row) return;
    const colId = visibleColIds[colIdx];
    const meta = COL_CATALOG.find(c => c.id === colId);
    if (!meta?.editable || meta.editType === 'status') return;
    const a = row.activity;
    let val = '';
    if (colId === 'title') val = a.title;
    else if (colId === 'startAt') val = toDateInput(a.startAt);
    else if (colId === 'endAt') val = toDateInput(a.endAt);
    else if (colId === 'description') val = a.description ?? '';
    else if (colId === 'location') val = a.location ?? '';
    else if (colId === 'url') val = a.url ?? '';
    else if (colId === 'notes') val = (a as ApiActivity & { notes?: string | null }).notes ?? '';
    else if (colId === 'progress') val = String(a.percentComplete ?? 0);
    setEditingCell({ rowIdx, colIdx, value: val });
  }, [activityRows, visibleColIds]);

  const cancelEdit = useCallback(() => setEditingCell(null), []);

  const commitAndMove = useCallback(
    (dir: 'down' | 'right' | 'left') => {
      if (!editingCell) return;
      commitEdit(editingCell.rowIdx, visibleColIds[editingCell.colIdx], editingCell.value);
      setEditingCell(null);

      if (dir === 'down') {
        const nextRow = Math.min(editingCell.rowIdx + 1, activityRows.length - 1);
        setSelectedRowIdx(nextRow);
      } else if (dir === 'right') {
        let nextColIdx = editingCell.colIdx + 1;
        let nextRowIdx = editingCell.rowIdx;
        if (nextColIdx >= visibleColIds.length) {
          if (editingCell.rowIdx < activityRows.length - 1) {
            nextColIdx = 0;
            nextRowIdx = editingCell.rowIdx + 1;
          } else {
            nextColIdx = visibleColIds.length - 1; // clamp at last cell of last row
          }
        }
        setSelectedColIdx(nextColIdx);
        setSelectedRowIdx(nextRowIdx);
        const colId = visibleColIds[nextColIdx];
        const meta = COL_CATALOG.find(c => c.id === colId);
        const isText = meta?.editable && meta.editType !== 'status' && meta.editType !== 'none' &&
          meta.editType !== 'identity' && meta.editType !== 'assignees' &&
          meta.editType !== 'tags' && meta.editType !== 'parent';
        if (isText) enterEdit(nextRowIdx, nextColIdx);
      } else if (dir === 'left') {
        let prevColIdx = editingCell.colIdx - 1;
        let prevRowIdx = editingCell.rowIdx;
        if (prevColIdx < 0) {
          if (editingCell.rowIdx > 0) {
            prevColIdx = visibleColIds.length - 1;
            prevRowIdx = editingCell.rowIdx - 1;
          } else {
            prevColIdx = 0; // clamp at first cell of first row
          }
        }
        setSelectedColIdx(prevColIdx);
        setSelectedRowIdx(prevRowIdx);
        const colId = visibleColIds[prevColIdx];
        const meta = COL_CATALOG.find(c => c.id === colId);
        const isText = meta?.editable && meta.editType !== 'status' && meta.editType !== 'none' &&
          meta.editType !== 'identity' && meta.editType !== 'assignees' &&
          meta.editType !== 'tags' && meta.editType !== 'parent';
        if (isText) enterEdit(prevRowIdx, prevColIdx);
      }
    },
    [editingCell, commitEdit, visibleColIds, activityRows.length, enterEdit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (editingCell) {
        // Edit mode key handling is in the input's own onKeyDown
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (activityRows.length === 0) return;
        if (selectedRowIdx === null) {
          setSelectedRowIdx(0);
          setSelectedColIdx(0);
          return;
        }
        if (e.shiftKey) {
          let prevCol = selectedColIdx - 1;
          let prevRow = selectedRowIdx;
          if (prevCol < 0) {
            if (selectedRowIdx > 0) {
              prevCol = visibleColIds.length - 1;
              prevRow = selectedRowIdx - 1;
            } else {
              prevCol = 0; // clamp at first cell of first row
            }
          }
          setSelectedColIdx(prevCol);
          setSelectedRowIdx(prevRow);
        } else {
          let nextCol = selectedColIdx + 1;
          let nextRow = selectedRowIdx;
          if (nextCol >= visibleColIds.length) {
            if (selectedRowIdx < activityRows.length - 1) {
              nextCol = 0;
              nextRow = selectedRowIdx + 1;
            } else {
              nextCol = visibleColIds.length - 1; // clamp at last cell of last row
            }
          }
          setSelectedColIdx(nextCol);
          setSelectedRowIdx(nextRow);
        }
        return;
      }

      if (selectedRowIdx === null) {
        if (e.key === 'ArrowDown') { setSelectedRowIdx(0); e.preventDefault(); }
        return;
      }

      if (e.key === 'ArrowDown') {
        setSelectedRowIdx(r => Math.min((r ?? 0) + 1, activityRows.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedRowIdx(r => Math.max((r ?? 0) - 1, 0));
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        setSelectedColIdx(c => Math.min(c + 1, visibleColIds.length - 1));
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        setSelectedColIdx(c => Math.max(c - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'F2') {
        const colId = visibleColIds[selectedColIdx];
        const meta = COL_CATALOG.find(c => c.id === colId);
        const isTextEditable = meta?.editable && meta.editType !== 'none' &&
          meta.editType !== 'status' && meta.editType !== 'identity' &&
          meta.editType !== 'assignees' && meta.editType !== 'tags' && meta.editType !== 'parent';
        if (isTextEditable) enterEdit(selectedRowIdx, selectedColIdx);
        e.preventDefault();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const colId = visibleColIds[selectedColIdx];
        const meta = COL_CATALOG.find(c => c.id === colId);
        const isTextEditable = meta?.editable && meta.editType !== 'none' &&
          meta.editType !== 'status' && meta.editType !== 'identity' &&
          meta.editType !== 'assignees' && meta.editType !== 'tags' && meta.editType !== 'parent';
        if (isTextEditable) setEditingCell({ rowIdx: selectedRowIdx, colIdx: selectedColIdx, value: e.key });
      }
    },
    [editingCell, selectedRowIdx, selectedColIdx, activityRows, visibleColIds, enterEdit],
  );

  // When triggerNewRow increments, create a new "New Activity" row and queue title edit
  useEffect(() => {
    if (!triggerNewRow || triggerNewRow === prevTriggerNewRow.current) return;
    prevTriggerNewRow.current = triggerNewRow;
    const today = new Date().toISOString().slice(0, 10);
    create.mutate(
      { title: 'New Activity', startAt: `${today}T00:00:00Z`, endAt: `${today}T00:00:00Z` },
      { onSuccess: (created) => { pendingEditActivityId.current = created.id; } },
    );
  }, [triggerNewRow]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a new activity appears in activityRows, enter title-edit mode on it
  useEffect(() => {
    if (!pendingEditActivityId.current) return;
    const rowIdx = activityRows.findIndex(r => r.activity.id === pendingEditActivityId.current);
    if (rowIdx < 0) return;
    pendingEditActivityId.current = null;
    setSelectedRowIdx(rowIdx);
    const titleColIdx = visibleColIds.indexOf('title');
    if (titleColIdx >= 0) {
      setEditingCell({ rowIdx, colIdx: titleColIdx, value: 'New Activity' });
    }
  }, [activityRows, visibleColIds]);

  // ── Color-by resolution ────────────────────────────────────────────────────

  const getRowAccentColor = useCallback(
    (activity: ApiActivity): string | null => {
      if (colorBy === 'activity') return resolveColorHex(activity.color ?? null);
      if (colorBy === 'member') {
        const firstId = (activity.assignedMemberIds ?? [])[0];
        if (!firstId) return null;
        const m = memberById.get(firstId);
        return resolveColorHex(m?.color ?? null);
      }
      if (colorBy === 'status') {
        if (!activity.statusId) return null;
        const s = statusById.get(activity.statusId);
        return resolveColorHex(s?.color ?? null);
      }
      return null;
    },
    [colorBy, memberById, statusById],
  );

  // ── Picker state — all rendered as portals to escape table overflow ──────

  const [statusPickerFor, setStatusPickerFor] = useState<string | null>(null);
  const [statusPickerPos, setStatusPickerPos] = useState<{ top: number; left: number } | null>(null);
  const closeStatusPicker = useCallback(() => {
    setStatusPickerFor(null);
    setStatusPickerPos(null);
  }, []);

  const [assigneePickerFor, setAssigneePickerFor] = useState<string | null>(null);
  const [assigneePickerPos, setAssigneePickerPos] = useState<{ top: number; left: number } | null>(null);
  const closeAssigneePicker = useCallback(() => {
    setAssigneePickerFor(null);
    setAssigneePickerPos(null);
  }, []);

  const [tagPickerFor, setTagPickerFor] = useState<string | null>(null);
  const [tagPickerPos, setTagPickerPos] = useState<{ top: number; left: number } | null>(null);
  const closeTagPicker = useCallback(() => {
    setTagPickerFor(null);
    setTagPickerPos(null);
  }, []);

  const [parentPickerFor, setParentPickerFor] = useState<string | null>(null);
  const [parentPickerPos, setParentPickerPos] = useState<{ top: number; left: number } | null>(null);
  const closeParentPicker = useCallback(() => {
    setParentPickerFor(null);
    setParentPickerPos(null);
  }, []);

  const [identityPickerFor, setIdentityPickerFor] = useState<string | null>(null);
  const [identityPickerPos, setIdentityPickerPos] = useState<{ top: number; left: number } | null>(null);
  const identityPickerRef = useRef<HTMLDivElement>(null);
  const closeIdentityPicker = useCallback(() => {
    setIdentityPickerFor(null);
    setIdentityPickerPos(null);
  }, []);

  // Click-outside closes the identity picker
  useEffect(() => {
    if (!identityPickerFor) return;
    function handler(e: MouseEvent) {
      if (identityPickerRef.current && !identityPickerRef.current.contains(e.target as Node)) {
        closeIdentityPicker();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [identityPickerFor, closeIdentityPicker]);

  // Multi-select state for row checkboxes
  const [selectedActivityIds, setSelectedActivityIds] = useState<Set<string>>(new Set());
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Holds the ID of a newly created activity that should enter title-edit mode
  const pendingEditActivityId = useRef<string | null>(null);
  // Guards against re-firing triggerNewRow on re-renders
  const prevTriggerNewRow = useRef<number>(0);

  // ── Multi-select delete ────────────────────────────────────────────────────

  const handleDeleteSelected = useCallback(() => {
    for (const id of Array.from(selectedActivityIds)) {
      deleteAct.mutate(id);
    }
    setSelectedActivityIds(new Set());
  }, [selectedActivityIds, deleteAct]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD column reorder ─────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      // Pinned columns can't be reordered past each other
      const pinnedIds = ['colorBar', 'identity', 'title'];
      if (pinnedIds.includes(String(active.id)) || pinnedIds.includes(String(over.id))) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      if (prefsApplied.current) debouncedSaveCols(columnVisibility, next, columnSizing);
      return next;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const rowH = 40; // always comfortable

  const visibleHeaders = table.getHeaderGroups()[0]?.headers ?? [];

  // Build a map from colId → left offset for sticky pinning
  const pinnedLeft = useMemo(() => {
    let left = 0;
    const offsets: Record<string, number> = {};
    for (const h of visibleHeaders) {
      if (h.column.getIsPinned() === 'left') {
        offsets[h.id] = left;
        left += h.getSize();
      }
    }
    return offsets;
  }, [visibleHeaders]);

  const tableWidth = visibleHeaders.reduce((acc, h) => acc + h.getSize(), 0);

  // Status picker activity (for the portal)
  const statusPickerActivity = statusPickerFor ? activityById.get(statusPickerFor) : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        flex: 1,
        overflow: 'auto',
        outline: 'none',
        background: 'var(--background)',
        position: 'relative',
      }}
      onClick={e => {
        if ((e.target as HTMLElement) === containerRef.current) {
          setSelectedRowIdx(null);
          setEditingCell(null);
          onSelectActivity?.(null);
        }
      }}
    >
      {/* Selection action bar — appears above the table when rows are checked */}
      {selectedActivityIds.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 12px',
            height: 36,
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
            {selectedActivityIds.size} selected
          </span>
          <button
            onClick={handleDeleteSelected}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', fontSize: 12, cursor: 'pointer',
              background: 'var(--destructive)', color: 'var(--destructive-foreground)',
              border: 'none', borderRadius: 4, fontFamily: 'var(--font-sans)',
            }}
          >
            <Trash2 size={12} />
            Delete
          </button>
          <button
            onClick={() => setSelectedActivityIds(new Set())}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', fontSize: 12, cursor: 'pointer',
              background: 'none', color: 'var(--foreground)',
              border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'var(--font-sans)',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* DndContext must be outside <table> — its accessibility <div> is invalid inside <thead>. */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <table
        style={{
          width: tableWidth,
          minWidth: '100%',
          borderCollapse: 'separate',
          borderSpacing: 0,
          tableLayout: 'fixed',
        }}
      >
        {/* Column sizing */}
        <colgroup>
          {visibleHeaders.map(h => (
            <col key={h.id} style={{ width: h.getSize() }} />
          ))}
        </colgroup>

        {/* Header */}
        <thead>
          <SortableContext
            items={visibleHeaders.map(h => h.id)}
            strategy={horizontalListSortingStrategy}
          >
            <tr style={{ height: 36 }}>
              {visibleHeaders.map(header => {
                  const colId = header.id;
                  const isPinned = header.column.getIsPinned() === 'left';
                  const sortState = sorting[0];
                  const sortDir = sortState?.id === colId ? (sortState.desc ? 'desc' : 'asc') : false;
                  const meta = COL_CATALOG.find(c => c.id === colId);

                  if (colId === 'colorBar') {
                    const allChecked = activityRows.length > 0 &&
                      activityRows.every(r => selectedActivityIds.has(r.activity.id));
                    const someChecked = !allChecked &&
                      activityRows.some(r => selectedActivityIds.has(r.activity.id));
                    return (
                      <th
                        key={colId}
                        style={{
                          width: 24,
                          position: 'sticky',
                          left: pinnedLeft[colId] ?? 0,
                          top: 0,
                          zIndex: 20,
                          background: 'var(--card)',
                          borderBottom: '2px solid var(--border)',
                          padding: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
                          <div style={{ width: 4, flexShrink: 0 }} />
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={el => { if (el) el.indeterminate = someChecked; }}
                              onChange={() => {
                                if (allChecked || someChecked) {
                                  setSelectedActivityIds(new Set());
                                } else {
                                  setSelectedActivityIds(new Set(activityRows.map(r => r.activity.id)));
                                }
                              }}
                              style={{ cursor: 'pointer', width: 13, height: 13 }}
                              title="Select all"
                            />
                          </div>
                        </div>
                      </th>
                    );
                  }

                  return (
                    <SortableColHeader
                      key={colId}
                      colId={colId}
                      style={{
                        width: header.getSize(),
                        left: isPinned ? pinnedLeft[colId] : undefined,
                        position: 'sticky',
                        zIndex: isPinned ? 20 : 10,
                        boxShadow: isPinned ? '2px 0 4px rgba(0,0,0,0.06)' : undefined,
                      }}
                      sortDir={meta?.editType !== 'none' ? sortDir : false}
                      onSort={meta?.editType !== 'none' ? () => {
                        setSorting(prev => {
                          if (prev[0]?.id !== colId) return [{ id: colId, desc: false }];
                          if (!prev[0].desc) return [{ id: colId, desc: true }];
                          return [];
                        });
                      } : undefined}
                      resizeHandler={header.getResizeHandler() as unknown as (e: React.MouseEvent | React.TouchEvent) => void}
                      isResizing={header.column.getIsResizing()}
                    >
                      {header.column.columnDef.header as string}
                    </SortableColHeader>
                  );
                })}
              </tr>
            </SortableContext>
        </thead>

        {/* Body */}
        <tbody>
          {displayRows.length === 0 && (
            <tr>
              <td
                colSpan={visibleHeaders.length}
                style={{
                  textAlign: 'center',
                  padding: '48px 0',
                  color: 'var(--muted-foreground)',
                  fontSize: 13,
                }}
              >
                No activities to show.
              </td>
            </tr>
          )}

          {displayRows.map((row, displayIdx) => {
            // ── Group header row ─────────────────────────────────────────────
            if (row.kind === 'group') {
              const collapsed = collapsedGroups.has(row.key);
              return (
                <tr key={`group-${row.key}`}>
                  <td
                    colSpan={visibleHeaders.length}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--muted)',
                      borderBottom: '1px solid var(--border)',
                      borderTop: displayIdx > 0 ? '1px solid var(--border)' : undefined,
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--muted-foreground)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={() => toggleGroup(row.key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      {row.label}
                      <span style={{ fontWeight: 400, opacity: 0.6 }}>({row.count})</span>
                    </div>
                  </td>
                </tr>
              );
            }

            // ── Activity row ─────────────────────────────────────────────────
            const { activity, depth, hasChildren, groupKey } = row;
            const actRowIdx = activityRows.indexOf(row);
            const isSelected = actRowIdx === selectedRowIdx;
            const isDetailOpen = activity.id === selectedActivityId;
            const accentColor = getRowAccentColor(activity);

            const isMatch = debouncedQuery && matchedIds.includes(activity.id);
            const isActiveMatch = activity.id === activeMatchId;
            const isDimmed = debouncedQuery && matchedIds.length > 0 && !isMatch;

            const rowStyle: React.CSSProperties = {
              height: rowH,
              opacity: isDimmed ? 0.3 : 1,
              background: isDetailOpen
                ? 'var(--muted)'
                : isSelected
                ? 'color-mix(in srgb, var(--primary) 8%, var(--background))'
                : 'transparent',
              cursor: 'default',
              outline: isActiveMatch
                ? '2px solid #f59e0b'
                : isMatch
                ? '1px solid rgba(245,158,11,0.6)'
                : undefined,
              transition: 'background 0.1s ease, opacity 0.15s ease',
            };

            return (
              <tr
                key={activity.id}
                ref={isActiveMatch ? el => { (activeRowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el } : undefined}
                style={rowStyle}
                onMouseEnter={() => setHoveredRowId(activity.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                onClick={e => {
                  e.stopPropagation();
                  setSelectedRowIdx(actRowIdx);
                  onSelectActivity?.(activity.id);
                  // intentionally no onSelectApiActivity — edits happen inline
                }}
              >
                {visibleHeaders.map((header, colIdx) => {
                  const colId = header.id;
                  const isPinned = header.column.getIsPinned() === 'left';
                  const isCellSelected = isSelected && colIdx === selectedColIdx;
                  const isEditing = editingCell?.rowIdx === actRowIdx && editingCell.colIdx === colIdx;
                  const meta = COL_CATALOG.find(c => c.id === colId)!;

                  const cellStyle: React.CSSProperties = {
                    width: header.getSize(),
                    maxWidth: header.getSize(),
                    padding: '0 8px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 12,
                    color: 'var(--foreground)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    position: isPinned ? 'sticky' : undefined,
                    left: isPinned ? pinnedLeft[colId] : undefined,
                    zIndex: isPinned ? 5 : undefined,
                    background: isPinned
                      ? (isDetailOpen ? 'var(--muted)' : isSelected ? 'color-mix(in srgb, var(--primary) 8%, var(--background))' : 'var(--background)')
                      : undefined,
                    boxShadow: isPinned ? '2px 0 4px rgba(0,0,0,0.06)' : undefined,
                    outline: isCellSelected && !isEditing ? '2px solid var(--primary)' : undefined,
                    outlineOffset: '-2px',
                    verticalAlign: 'middle',
                    cursor: (meta.editType === 'text' || meta.editType === 'date' || meta.editType === 'number')
                      ? 'text'
                      : (meta.editType !== 'none' ? 'pointer' : 'default'),
                  };

                  // ── Cell content ──────────────────────────────────────────

                  // Editing mode — inline input
                  if (isEditing && meta.editType !== 'none' && meta.editType !== 'status') {
                    return (
                      <td key={colId} style={{ ...cellStyle, padding: 0, overflow: 'visible' }}>
                        <input
                          ref={editInputRef}
                          type={meta.editType === 'date' ? 'date' : meta.editType === 'number' ? 'number' : 'text'}
                          min={meta.editType === 'number' ? 0 : undefined}
                          max={meta.editType === 'number' ? 100 : undefined}
                          value={editingCell.value}
                          onChange={e => setEditingCell(prev => prev ? { ...prev, value: e.target.value } : prev)}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Escape') { cancelEdit(); e.preventDefault(); }
                            else if (e.key === 'Enter') { commitAndMove('down'); e.preventDefault(); }
                            else if (e.key === 'Tab') { commitAndMove(e.shiftKey ? 'left' : 'right'); e.preventDefault(); }
                          }}
                          onBlur={() => {
                            commitEdit(editingCell.rowIdx, visibleColIds[editingCell.colIdx], editingCell.value);
                            setEditingCell(null);
                          }}
                          style={{
                            width: '100%',
                            height: rowH,
                            padding: '0 8px',
                            background: 'var(--background)',
                            border: 'none',
                            outline: '2px solid var(--primary)',
                            outlineOffset: '-2px',
                            fontSize: 12,
                            color: 'var(--foreground)',
                            fontFamily: 'var(--font-sans)',
                          }}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                    );
                  }

                  // Color bar + row checkbox — 32px pinned cell
                  if (colId === 'colorBar') {
                    const isRowChecked = selectedActivityIds.has(activity.id);
                    const showCb = isRowChecked || selectedActivityIds.size > 0 || hoveredRowId === activity.id;
                    return (
                      <td
                        key={colId}
                        style={{
                          width: 24,
                          maxWidth: 24,
                          padding: 0,
                          borderBottom: '1px solid var(--border)',
                          position: 'sticky',
                          left: pinnedLeft[colId] ?? 0,
                          zIndex: 5,
                          background: accentColor
                            ?? (isDetailOpen
                              ? 'var(--muted)'
                              : isSelected
                              ? 'color-mix(in srgb, var(--primary) 8%, var(--background))'
                              : 'var(--background)'),
                          cursor: 'default',
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedActivityIds(prev => {
                            const next = new Set(prev);
                            if (next.has(activity.id)) next.delete(activity.id);
                            else next.add(activity.id);
                            return next;
                          });
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: rowH,
                          opacity: showCb ? 1 : 0,
                          transition: 'opacity 0.1s',
                        }}>
                          <input
                            type="checkbox"
                            checked={isRowChecked}
                            onChange={() => {}}
                            onClick={e => e.stopPropagation()}
                            style={{ cursor: 'pointer', width: 13, height: 13, pointerEvents: 'none' }}
                          />
                        </div>
                      </td>
                    );
                  }

                  // Identity cell — shows badge; click opens identity picker portal
                  if (colId === 'identity') {
                    return (
                      <td
                        key={colId}
                        style={{ ...cellStyle, cursor: 'pointer' }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedRowIdx(actRowIdx);
                          onSelectActivity?.(activity.id);
                          if (identityPickerFor === activity.id) {
                            closeIdentityPicker();
                          } else {
                            closeStatusPicker(); closeAssigneePicker(); closeTagPicker(); closeParentPicker();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setIdentityPickerFor(activity.id);
                            setIdentityPickerPos(popoverPos(rect, 240, 320));
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Badge
                            identity={{
                              color: resolveColorHex(activity.color ?? null) ?? '#288C9B',
                              icon: activity.icon ?? '__name_2__',
                            }}
                            name={activity.title}
                            shape="square"
                            size={28}
                          />
                        </div>
                      </td>
                    );
                  }

                  // Status cell — click to open picker (portal, escapes scroll overflow)
                  if (colId === 'status') {
                    const status = activity.statusId ? statusById.get(activity.statusId) : null;
                    return (
                      <td
                        key={colId}
                        style={{ ...cellStyle, cursor: 'pointer' }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedRowIdx(actRowIdx);
                          onSelectActivity?.(activity.id);
                          if (statusPickerFor === activity.id) {
                            closeStatusPicker();
                          } else {
                            closeAssigneePicker(); closeTagPicker(); closeParentPicker(); closeIdentityPicker();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setStatusPickerFor(activity.id);
                            setStatusPickerPos(popoverPos(rect, 160, 220));
                          }
                        }}
                      >
                        {status ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 500,
                              background: `color-mix(in srgb, ${resolveColorHex(status.color ?? null) ?? '#888'} 15%, transparent)`,
                              color: resolveColorHex(status.color ?? null) ?? 'var(--foreground)',
                              border: `1px solid ${resolveColorHex(status.color ?? null) ?? '#888'}40`,
                            }}
                          >
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: resolveColorHex(status.color ?? null) ?? '#888',
                                flexShrink: 0,
                              }}
                            />
                            {status.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                    );
                  }

                  // Assignees cell — overlapping badges; click opens picker
                  if (colId === 'assignees') {
                    const ids = activity.assignedMemberIds ?? [];
                    return (
                      <td key={colId} style={cellStyle} onClick={e => {
                        e.stopPropagation();
                        setSelectedRowIdx(actRowIdx);
                        onSelectActivity?.(activity.id);
                        if (assigneePickerFor === activity.id) {
                          closeAssigneePicker();
                        } else {
                          closeStatusPicker(); closeTagPicker(); closeParentPicker(); closeIdentityPicker();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setAssigneePickerFor(activity.id);
                          setAssigneePickerPos(popoverPos(rect, 180, 240));
                        }
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                          {ids.slice(0, 4).map((mid, i) => {
                            const m = memberById.get(mid);
                            if (!m) return null;
                            return (
                              <div key={mid} style={{ marginLeft: i === 0 ? 0 : -6 }} title={m.displayName}>
                                <Badge
                                  identity={{ color: resolveColorHex(m.color ?? null) ?? '#288C9B', icon: m.icon ?? '__name_2__' }}
                                  name={m.displayName}
                                  shape="circle"
                                  size={22}
                                />
                              </div>
                            );
                          })}
                          {ids.length > 4 && (
                            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 4 }}>+{ids.length - 4}</span>
                          )}
                          {ids.length === 0 && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Tags cell — click opens tag picker
                  if (colId === 'tags') {
                    const tagList = (activity.tagIds ?? [])
                      .map(tid => tags.find(t => t.id === tid))
                      .filter(Boolean) as Tag[];
                    return (
                      <td key={colId} style={cellStyle} onClick={e => {
                        e.stopPropagation();
                        setSelectedRowIdx(actRowIdx);
                        onSelectActivity?.(activity.id);
                        if (tagPickerFor === activity.id) {
                          closeTagPicker();
                        } else {
                          closeStatusPicker(); closeAssigneePicker(); closeParentPicker(); closeIdentityPicker();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setTagPickerFor(activity.id);
                          setTagPickerPos(popoverPos(rect, 220, 300));
                        }
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flexWrap: 'nowrap' }}>
                          {tagList.slice(0, 3).map(t => (
                            <span
                              key={t.id}
                              style={{
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                background: resolveColorHex(t.color ?? null)
                                  ? `color-mix(in srgb, ${resolveColorHex(t.color ?? null)} 18%, transparent)`
                                  : 'var(--muted)',
                                color: resolveColorHex(t.color ?? null) ?? 'var(--foreground)',
                                border: `1px solid ${resolveColorHex(t.color ?? null) ?? 'var(--border)'}40`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                          {tagList.length > 3 && (
                            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>+{tagList.length - 3}</span>
                          )}
                          {tagList.length === 0 && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Progress cell
                  if (colId === 'progress') {
                    const pct = activity.percentComplete ?? 0;
                    return (
                      <td key={colId} style={cellStyle} onClick={e => {
                          e.stopPropagation();
                          setSelectedRowIdx(actRowIdx);
                          onSelectActivity?.(activity.id);
                          enterEdit(actRowIdx, colIdx);
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              background: 'var(--border)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: 'var(--primary)',
                                borderRadius: 2,
                                transition: 'width 0.2s',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    );
                  }

                  // Parent cell — click opens parent picker
                  if (colId === 'parent') {
                    const parent = activity.parentActivityId ? activityById.get(activity.parentActivityId) : null;
                    return (
                      <td key={colId} style={cellStyle} onClick={e => {
                        e.stopPropagation();
                        setSelectedRowIdx(actRowIdx);
                        onSelectActivity?.(activity.id);
                        if (parentPickerFor === activity.id) {
                          closeParentPicker();
                        } else {
                          closeStatusPicker(); closeAssigneePicker(); closeTagPicker(); closeIdentityPicker();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setParentPickerFor(activity.id);
                          setParentPickerPos(popoverPos(rect, 220, 280));
                        }
                      }}>
                        <span style={{ color: parent ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                          {parent ? parent.title : '—'}
                        </span>
                      </td>
                    );
                  }

                  // Duration cell
                  if (colId === 'duration') {
                    return (
                      <td key={colId} style={cellStyle}>
                        <span style={{ color: 'var(--muted-foreground)' }}>
                          {formatDuration(activity.startAt, activity.endAt)}
                        </span>
                      </td>
                    );
                  }

                  // Date cells — single click to edit
                  if (colId === 'startAt' || colId === 'endAt') {
                    const iso = colId === 'startAt' ? activity.startAt : activity.endAt;
                    return (
                      <td
                        key={colId}
                        style={cellStyle}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedRowIdx(actRowIdx);
                          onSelectActivity?.(activity.id);
                          enterEdit(actRowIdx, colIdx);
                        }}
                      >
                        <span style={{ color: iso ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                          {formatDate(iso)}
                        </span>
                      </td>
                    );
                  }

                  // Created/Updated cells
                  if (colId === 'createdAt' || colId === 'updatedAt') {
                    const iso = colId === 'createdAt' ? activity.createdAt : activity.updatedAt;
                    return (
                      <td key={colId} style={cellStyle}>
                        <span style={{ color: 'var(--muted-foreground)' }}>
                          {formatDate(iso)}
                        </span>
                      </td>
                    );
                  }

                  // Text cells (title, description, location, url, notes)
                  let textVal = '';
                  if (colId === 'title') textVal = activity.title;
                  else if (colId === 'description') textVal = activity.description ?? '';
                  else if (colId === 'location') textVal = activity.location ?? '';
                  else if (colId === 'url') textVal = activity.url ?? '';
                  else if (colId === 'notes') textVal = (activity as ApiActivity & { notes?: string | null }).notes ?? '';

                  return (
                    <td
                      key={colId}
                      style={{ ...cellStyle, fontWeight: colId === 'title' ? 500 : 400 }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedRowIdx(actRowIdx);
                        onSelectActivity?.(activity.id);
                        if (meta.editable && meta.editType === 'text') enterEdit(actRowIdx, colIdx);
                      }}
                    >
                      {colId === 'title' && groupBy === 'parent' ? (
                        // Parent-group mode: show indent + collapse toggle
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: depth * 16 }}>
                          {hasChildren ? (
                            <span
                              onClick={e => { e.stopPropagation(); toggleGroup(groupKey); }}
                              style={{ cursor: 'pointer', flexShrink: 0, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center' }}
                            >
                              {collapsedGroups.has(groupKey) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                            </span>
                          ) : depth > 0 ? (
                            <span style={{ width: 13, flexShrink: 0 }} />
                          ) : null}
                          <span title={textVal} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {textVal || '—'}
                          </span>
                        </span>
                      ) : (
                        <span
                          title={textVal}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: textVal ? 'var(--foreground)' : 'var(--muted-foreground)',
                          }}
                        >
                          {textVal || '—'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </DndContext>

      {/* Status picker portal */}
      {statusPickerFor && statusPickerPos && statusPickerActivity &&
        createPortal(
          <StatusPicker
            value={statusPickerActivity.statusId}
            statuses={timelineStatuses}
            onChange={statusId => {
              update.mutate({ activityId: statusPickerFor, patch: { statusId } });
              closeStatusPicker();
            }}
            onClose={closeStatusPicker}
            positionStyle={{ position: 'fixed', top: statusPickerPos.top, left: statusPickerPos.left }}
          />,
          document.body,
        )
      }

      {/* Assignee picker portal */}
      {assigneePickerFor && assigneePickerPos &&
        createPortal(
          <AssigneePicker
            members={members}
            selectedIds={activityById.get(assigneePickerFor)?.assignedMemberIds ?? []}
            onToggle={memberId => {
              const activity = activityById.get(assigneePickerFor);
              if (!activity) return;
              const current = activity.assignedMemberIds ?? [];
              const next = current.includes(memberId)
                ? current.filter(id => id !== memberId)
                : [...current, memberId];
              update.mutate({ activityId: assigneePickerFor, patch: { assignedMemberIds: next } });
            }}
            onClose={closeAssigneePicker}
            positionStyle={{ position: 'fixed', top: assigneePickerPos.top, left: assigneePickerPos.left }}
          />,
          document.body,
        )
      }

      {/* Tag picker portal */}
      {tagPickerFor && tagPickerPos &&
        createPortal(
          <TagPicker
            teamId={teamId}
            tags={tags}
            selectedTagIds={(activityById.get(tagPickerFor)?.tagIds as string[] | undefined) ?? []}
            onChange={ids => {
              update.mutate({ activityId: tagPickerFor, patch: { tagIds: ids } as Partial<ApiActivity> });
            }}
            onClose={closeTagPicker}
            positionStyle={{ position: 'fixed', top: tagPickerPos.top, left: tagPickerPos.left }}
          />,
          document.body,
        )
      }

      {/* Parent picker portal */}
      {parentPickerFor && parentPickerPos &&
        createPortal(
          <ParentPicker
            activities={rawActivities.filter(a => a.id !== parentPickerFor)}
            value={activityById.get(parentPickerFor)?.parentActivityId}
            onChange={id => {
              update.mutate({ activityId: parentPickerFor, patch: { parentActivityId: id } as Partial<ApiActivity> });
              closeParentPicker();
            }}
            onClose={closeParentPicker}
            positionStyle={{ position: 'fixed', top: parentPickerPos.top, left: parentPickerPos.left }}
          />,
          document.body,
        )
      }

      {/* Identity picker portal */}
      {identityPickerFor && identityPickerPos && (() => {
        const identityActivity = activityById.get(identityPickerFor);
        if (!identityActivity) return null;
        return createPortal(
          <div
            ref={identityPickerRef}
            style={{
              position: 'fixed',
              top: identityPickerPos.top,
              left: identityPickerPos.left,
              zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          >
            <IdentityPicker
              identity={{
                color: resolveColorHex(identityActivity.color ?? null) ?? '#288C9B',
                icon: identityActivity.icon ?? '__name_2__',
              }}
              name={identityActivity.title}
              shape="square"
              onChange={(next: Identity) => {
                update.mutate({ activityId: identityPickerFor, patch: { color: next.color, icon: next.icon } });
              }}
            />
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
