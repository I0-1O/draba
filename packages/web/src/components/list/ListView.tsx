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
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { useTimelineActivities, useTeamMembers, useUpdateActivity } from '@/hooks/useTeamActivities';
import { usePreferenceMap, useUpsertPreference, usePreferences } from '@/hooks/usePreferences';
import { useFilter } from '@/contexts/FilterContext';
import { useFind } from '@/contexts/FindContext';
import { applyActiveFilter } from '@/lib/presetFilters';
import { matchEvents } from '@/lib/findMatcher';
import { resolveColorHex } from '@/components/identity/identity-constants';
import { Badge } from '@/components/identity/Badge';
import type { components } from '@draba/shared';
import type { Member } from '@/types';
import type { ListGroupBy, ListSortBy, ListColorBy, ListDensity, ColumnConfig } from './ListToolbar';

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
  editType: 'text' | 'date' | 'status' | 'number' | 'none';
}

const COL_CATALOG: ColMeta[] = [
  { id: 'title',       label: 'Title',       defaultVisible: true,  defaultWidth: 280, editable: true,  editType: 'text' },
  { id: 'startAt',     label: 'Start',       defaultVisible: true,  defaultWidth: 110, editable: true,  editType: 'date' },
  { id: 'endAt',       label: 'End',         defaultVisible: true,  defaultWidth: 110, editable: true,  editType: 'date' },
  { id: 'duration',    label: 'Duration',    defaultVisible: true,  defaultWidth: 90,  editable: false, editType: 'none' },
  { id: 'status',      label: 'Status',      defaultVisible: true,  defaultWidth: 130, editable: true,  editType: 'status' },
  { id: 'assignees',   label: 'Assignees',   defaultVisible: true,  defaultWidth: 130, editable: false, editType: 'none' },
  { id: 'tags',        label: 'Tags',        defaultVisible: true,  defaultWidth: 130, editable: false, editType: 'none' },
  { id: 'progress',    label: 'Progress',    defaultVisible: false, defaultWidth: 90,  editable: true,  editType: 'number' },
  { id: 'parent',      label: 'Parent',      defaultVisible: false, defaultWidth: 150, editable: false, editType: 'none' },
  { id: 'description', label: 'Description', defaultVisible: false, defaultWidth: 200, editable: true,  editType: 'text' },
  { id: 'location',    label: 'Location',    defaultVisible: false, defaultWidth: 130, editable: true,  editType: 'text' },
  { id: 'url',         label: 'URL',         defaultVisible: false, defaultWidth: 150, editable: true,  editType: 'text' },
  { id: 'createdAt',   label: 'Created',     defaultVisible: false, defaultWidth: 110, editable: false, editType: 'none' },
  { id: 'updatedAt',   label: 'Updated',     defaultVisible: false, defaultWidth: 110, editable: false, editType: 'none' },
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
  density: ListDensity;
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

function SortableColHeader({ colId, children, style, className, onSort, sortDir }: {
  colId: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onSort?: () => void;
  sortDir?: 'asc' | 'desc' | false;
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
        zIndex: colId === 'title' ? 20 : 10,
        background: 'var(--card)',
        borderBottom: '2px solid var(--border)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: onSort ? 'pointer' : 'default',
        fontWeight: 600,
        fontSize: 11,
        color: 'var(--muted-foreground)',
        padding: '0 8px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
      className={className}
      onClick={onSort}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
        {sortDir === 'asc' && <span style={{ opacity: 0.7 }}>↑</span>}
        {sortDir === 'desc' && <span style={{ opacity: 0.7 }}>↓</span>}
      </div>
    </th>
  );
}

// ── Status pill popover ────────────────────────────────────────────────────────

function StatusPicker({
  value,
  statuses,
  onChange,
  onClose,
}: {
  value: string | null | undefined;
  statuses: Status[];
  onChange: (id: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        zIndex: 100,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        minWidth: 160,
        padding: '6px 0',
        top: '100%',
        left: 0,
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function ListView({
  teamId,
  timelineId,
  groupBy,
  sortBy,
  colorBy,
  density,
  timelineStatuses = [],
  savedFilters = [],
  tags = [],
  onColumnsChange,
  pendingColumnToggle,
  onSelectActivity,
  onSelectApiActivity,
  selectedActivityId,
  onMembersLoaded,
}: Props) {
  const { activeFilter } = useFilter();
  const { debouncedQuery, registerMatches, matchedIds, activeMatchId } = useFind();

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: rawActivities = [] } = useTimelineActivities(teamId, timelineId);
  const { data: rawMembers = [] } = useTeamMembers(teamId);
  const update = useUpdateActivity(timelineId);

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
        // Merge saved order with any new columns added since the pref was saved
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

  // Debounce column-config saves
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
        minSize: 60,
        maxSize: 600,
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
      columnPinning: { left: ['title'] } as ColumnPinningState,
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

  // Expose column configs to toolbar via callback
  useEffect(() => {
    if (!onColumnsChange) return;
    const configs: ColumnConfig[] = table.getLeafHeaders().map(h => ({
      id: h.id,
      label: COL_CATALOG.find(c => c.id === h.id)?.label ?? h.id,
      visible: h.column.getIsVisible(),
    }));
    onColumnsChange(configs);
  }); // runs every render — intentional, keeps toolbar in sync

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
      // default sort by sortBy prop
      return acts.sort((a, b) => {
        if (sortBy === 'startDate') return (a.startAt ?? '').localeCompare(b.startAt ?? '');
        if (sortBy === 'endDate') return (a.endAt ?? '').localeCompare(b.endAt ?? '');
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'status') return (a.statusId ?? '').localeCompare(b.statusId ?? '');
        if (sortBy === 'progress') return (b.percentComplete ?? 0) - (a.percentComplete ?? 0);
        return 0;
      });
    }
    // column header sort
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
    | { kind: 'activity'; activity: ApiActivity };

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (groupBy === 'none') {
      return sortedActivities.map(a => ({ kind: 'activity' as const, activity: a }));
    }

    // Build groups
    const groups = new Map<string, { label: string; activities: ApiActivity[] }>();

    for (const activity of sortedActivities) {
      let key = '';
      let label = '';

      if (groupBy === 'member') {
        const ids = activity.assignedMemberIds ?? [];
        if (ids.length === 0) {
          key = '__unassigned__';
          label = 'Unassigned';
        } else {
          // Use first assignee
          key = ids[0];
          label = memberById.get(ids[0])?.displayName ?? 'Unknown';
        }
      } else if (groupBy === 'parent') {
        if (!activity.parentActivityId) {
          key = '__no_parent__';
          label = 'No parent';
        } else {
          key = activity.parentActivityId;
          label = activityById.get(activity.parentActivityId)?.title ?? 'Unknown parent';
        }
      } else if (groupBy === 'status') {
        if (!activity.statusId) {
          key = '__no_status__';
          label = 'No status';
        } else {
          key = activity.statusId;
          label = statusById.get(activity.statusId)?.name ?? 'Unknown status';
        }
      }

      const group = groups.get(key) ?? { label, activities: [] };
      group.activities.push(activity);
      groups.set(key, group);
    }

    const rows: DisplayRow[] = [];
    for (const [key, { label, activities }] of groups) {
      rows.push({ kind: 'group', key, label, count: activities.length });
      if (!collapsedGroups.has(key)) {
        for (const a of activities) rows.push({ kind: 'activity', activity: a });
      }
    }
    return rows;
  }, [sortedActivities, groupBy, memberById, statusById, activityById, collapsedGroups]);

  // Flat list of activity rows (for keyboard navigation indices)
  const activityRows = useMemo(
    () => displayRows.filter((r): r is { kind: 'activity'; activity: ApiActivity } => r.kind === 'activity'),
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

  // Indices into activityRows (not displayRows)
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null);
  const [selectedColIdx, setSelectedColIdx] = useState<number>(0);
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colIdx: number;
    value: string;
  } | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When a new activity is selected externally (e.g. detail panel), sync row idx
  useEffect(() => {
    if (!selectedActivityId) { setSelectedRowIdx(null); return; }
    const idx = activityRows.findIndex(r => r.activity.id === selectedActivityId);
    if (idx >= 0) setSelectedRowIdx(idx);
  }, [selectedActivityId, activityRows]);

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Visible column ids (in order)
  const visibleColIds = useMemo(
    () => table.getVisibleLeafColumns().map(c => c.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnOrder, columnVisibility],
  );

  const commitEdit = useCallback(
    (rowIdx: number, colId: string, value: string) => {
      const row = activityRows[rowIdx];
      if (!row) return;
      const a = row.activity;

      const patch: Partial<ApiActivity> = {};
      if (colId === 'title' && value.trim() !== '') patch.title = value.trim();
      else if (colId === 'startAt') patch.startAt = value ? `${value}T00:00:00Z` : undefined;
      else if (colId === 'endAt') patch.endAt = value ? `${value}T00:00:00Z` : undefined;
      else if (colId === 'description') patch.description = value || undefined;
      else if (colId === 'location') patch.location = value || undefined;
      else if (colId === 'url') patch.url = value || undefined;
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
    if (!meta?.editable || meta.editType === 'status') return; // status handled separately
    const a = row.activity;
    let val = '';
    if (colId === 'title') val = a.title;
    else if (colId === 'startAt') val = toDateInput(a.startAt);
    else if (colId === 'endAt') val = toDateInput(a.endAt);
    else if (colId === 'description') val = a.description ?? '';
    else if (colId === 'location') val = a.location ?? '';
    else if (colId === 'url') val = a.url ?? '';
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
        const nextColIdx = editingCell.colIdx + 1;
        if (nextColIdx < visibleColIds.length) {
          setSelectedColIdx(nextColIdx);
          const colId = visibleColIds[nextColIdx];
          const meta = COL_CATALOG.find(c => c.id === colId);
          if (meta?.editable && meta.editType !== 'status' && meta.editType !== 'none') {
            enterEdit(editingCell.rowIdx, nextColIdx);
          }
        }
      } else if (dir === 'left') {
        const prevColIdx = editingCell.colIdx - 1;
        if (prevColIdx >= 0) {
          setSelectedColIdx(prevColIdx);
          const colId = visibleColIds[prevColIdx];
          const meta = COL_CATALOG.find(c => c.id === colId);
          if (meta?.editable && meta.editType !== 'status' && meta.editType !== 'none') {
            enterEdit(editingCell.rowIdx, prevColIdx);
          }
        }
      }
    },
    [editingCell, commitEdit, visibleColIds, activityRows.length, enterEdit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // In edit mode
      if (editingCell) {
        if (e.key === 'Escape') { cancelEdit(); e.preventDefault(); }
        else if (e.key === 'Enter') { commitAndMove('down'); e.preventDefault(); }
        else if (e.key === 'Tab') {
          commitAndMove(e.shiftKey ? 'left' : 'right');
          e.preventDefault();
        }
        return;
      }

      // In selection mode
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
        if (meta?.editable && meta.editType !== 'none' && meta.editType !== 'status') {
          enterEdit(selectedRowIdx, selectedColIdx);
        }
        e.preventDefault();
      } else if (e.key === ' ') {
        // Space — open detail panel
        const row = activityRows[selectedRowIdx];
        if (row) {
          onSelectActivity?.(row.activity.id);
          onSelectApiActivity?.(row.activity);
        }
        e.preventDefault();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        // Start typing to enter edit mode
        const colId = visibleColIds[selectedColIdx];
        const meta = COL_CATALOG.find(c => c.id === colId);
        if (meta?.editable && meta.editType !== 'none' && meta.editType !== 'status') {
          setEditingCell({ rowIdx: selectedRowIdx, colIdx: selectedColIdx, value: e.key });
        }
      }
    },
    [editingCell, selectedRowIdx, selectedColIdx, activityRows, visibleColIds, cancelEdit, commitAndMove, enterEdit, onSelectActivity, onSelectApiActivity],
  );

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

  // ── Status inline edit state ───────────────────────────────────────────────

  const [statusPickerFor, setStatusPickerFor] = useState<string | null>(null); // activity id

  // ── DnD column reorder ─────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder(prev => {
      const oldIdx = prev.indexOf(String(active.id));
      const newIdx = prev.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return prev;
      // Don't allow reordering before the pinned title column
      if (newIdx === 0 || oldIdx === 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx);
      if (prefsApplied.current) debouncedSaveCols(columnVisibility, next, columnSizing);
      return next;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const rowH = density === 'compact' ? 32 : 40;

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
      // click on non-cell area deselects
      onClick={e => {
        if ((e.target as HTMLElement) === containerRef.current) {
          setSelectedRowIdx(null);
          setEditingCell(null);
          onSelectActivity?.(null);
          onSelectApiActivity?.(null);
        }
      }}
    >
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
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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

                  return (
                    <SortableColHeader
                      key={colId}
                      colId={colId}
                      style={{
                        width: header.getSize(),
                        left: isPinned ? pinnedLeft[colId] : undefined,
                        position: isPinned ? 'sticky' : 'sticky',
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
                    >
                      {header.column.columnDef.header as string}
                    </SortableColHeader>
                  );
                })}
              </tr>
            </SortableContext>
          </DndContext>
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
            const { activity } = row;
            const actRowIdx = activityRows.indexOf(row);
            const isSelected = actRowIdx === selectedRowIdx;
            const isDetailOpen = activity.id === selectedActivityId;
            const accentColor = getRowAccentColor(activity);

            // Find state
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
                onClick={e => {
                  e.stopPropagation();
                  setSelectedRowIdx(actRowIdx);
                  onSelectActivity?.(activity.id);
                  onSelectApiActivity?.(activity);
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
                    borderLeft: colIdx === 0 && accentColor ? `3px solid ${accentColor}` : undefined,
                    verticalAlign: 'middle',
                    cursor: meta.editable ? 'text' : 'default',
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
                          onKeyDown={e => e.stopPropagation()} // let the cell handle it above
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

                  // Status cell — click to open picker
                  if (colId === 'status') {
                    const status = activity.statusId ? statusById.get(activity.statusId) : null;
                    return (
                      <td
                        key={colId}
                        style={{ ...cellStyle, position: isPinned ? 'sticky' : 'relative', cursor: 'pointer' }}
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedRowIdx(actRowIdx);
                          setStatusPickerFor(prev => prev === activity.id ? null : activity.id);
                        }}
                      >
                        <div style={{ position: 'relative' }}>
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

                          {statusPickerFor === activity.id && (
                            <StatusPicker
                              value={activity.statusId}
                              statuses={timelineStatuses}
                              onChange={statusId => {
                                update.mutate({ activityId: activity.id, patch: { statusId } });
                                setStatusPickerFor(null);
                              }}
                              onClose={() => setStatusPickerFor(null)}
                            />
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Assignees cell
                  if (colId === 'assignees') {
                    const ids = activity.assignedMemberIds ?? [];
                    return (
                      <td key={colId} style={cellStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                          {ids.slice(0, 4).map(mid => {
                            const m = memberById.get(mid);
                            if (!m) return null;
                            return (
                              <Badge
                                key={mid}
                                identity={{ color: resolveColorHex(m.color ?? null) ?? '#288C9B', icon: m.icon ?? '__name_2__' }}
                                name={m.displayName}
                                shape="circle"
                                size={22}
                              />
                            );
                          })}
                          {ids.length > 4 && (
                            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>+{ids.length - 4}</span>
                          )}
                          {ids.length === 0 && (
                            <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // Tags cell
                  if (colId === 'tags') {
                    const tagList = (activity.tagIds ?? [])
                      .map(tid => tags.find(t => t.id === tid))
                      .filter(Boolean) as Tag[];
                    return (
                      <td key={colId} style={cellStyle}>
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
                      <td key={colId} style={cellStyle} onDoubleClick={() => enterEdit(actRowIdx, colIdx)}>
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

                  // Parent cell
                  if (colId === 'parent') {
                    const parent = activity.parentActivityId ? activityById.get(activity.parentActivityId) : null;
                    return (
                      <td key={colId} style={cellStyle}>
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

                  // Date cells
                  if (colId === 'startAt' || colId === 'endAt') {
                    const iso = colId === 'startAt' ? activity.startAt : activity.endAt;
                    return (
                      <td
                        key={colId}
                        style={cellStyle}
                        onDoubleClick={() => enterEdit(actRowIdx, colIdx)}
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

                  // Text cells (title, description, location, url)
                  let textVal = '';
                  if (colId === 'title') textVal = activity.title;
                  else if (colId === 'description') textVal = activity.description ?? '';
                  else if (colId === 'location') textVal = activity.location ?? '';
                  else if (colId === 'url') textVal = activity.url ?? '';

                  return (
                    <td
                      key={colId}
                      style={{ ...cellStyle, fontWeight: colId === 'title' ? 500 : 400 }}
                      onDoubleClick={() => {
                        if (meta.editable && meta.editType === 'text') enterEdit(actRowIdx, colIdx);
                      }}
                    >
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
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
