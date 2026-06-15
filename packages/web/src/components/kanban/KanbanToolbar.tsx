/**
 * KanbanToolbar — sub-toolbar for the Kanban view.
 *
 * Controls: Group by · Sort by · Color by · Card fields multi-select · Export/Share stubs.
 * Follows the same visual idiom as GanttToolbar and CalendarToolbar.
 */

import { useState, useRef, useEffect } from 'react';
import { Download, Share2, ChevronDown, Check, Network } from 'lucide-react';
import type { ColorBy } from '@/components/gantt/GanttToolbar';
import type { KanbanGroupBy, KanbanSortBy, KanbanCardField } from './kanbanColumns';
import { DEFAULT_CARD_FIELDS } from './kanbanColumns';

export type { KanbanGroupBy, KanbanSortBy, KanbanCardField };

interface Props {
  groupBy: KanbanGroupBy;
  onGroupByChange: (g: KanbanGroupBy) => void;
  sortBy: KanbanSortBy;
  onSortByChange: (s: KanbanSortBy) => void;
  colorBy: ColorBy;
  onColorByChange: (c: ColorBy) => void;
  cardFields: KanbanCardField[];
  onCardFieldsChange: (fields: KanbanCardField[]) => void;
  showHierarchy: boolean;
  onShowHierarchyChange: (on: boolean) => void;
  onExport?: () => void;
  onShare?: () => void;
}

const btn = 'flex items-center justify-center gap-[5px] h-[26px] px-2 border border-border rounded-md bg-card text-foreground text-xs font-medium cursor-pointer shrink-0 hover:bg-muted transition-colors';
const divider = 'w-px h-4 bg-border shrink-0';
const label = 'text-[11px] text-muted-foreground shrink-0';
const select = 'h-[26px] px-1.5 border border-border rounded-md bg-card text-foreground text-xs cursor-pointer shrink-0';

const ALL_CARD_FIELDS: { id: KanbanCardField; label: string }[] = [
  { id: 'dateRange',       label: 'Date range' },
  { id: 'status',          label: 'Status' },
  { id: 'tags',            label: 'Tags' },
  { id: 'members',         label: 'Assigned to' },
  { id: 'percentComplete', label: '% Complete' },
  { id: 'parent',          label: 'Parent' },
  { id: 'description',     label: 'Description' },
];

export default function KanbanToolbar({
  groupBy,
  onGroupByChange,
  sortBy,
  onSortByChange,
  colorBy,
  onColorByChange,
  cardFields,
  onCardFieldsChange,
  showHierarchy,
  onShowHierarchyChange,
  onExport,
  onShare,
}: Props) {
  const [cardFieldsOpen, setCardFieldsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardFieldsOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCardFieldsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [cardFieldsOpen]);

  function toggleField(id: KanbanCardField) {
    if (cardFields.includes(id)) {
      onCardFieldsChange(cardFields.filter(f => f !== id));
    } else {
      onCardFieldsChange([...cardFields, id]);
    }
  }

  const activeFieldCount = cardFields.length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        height: 36,
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Group by */}
      <span className={label}>Group by</span>
      <select
        className={select}
        value={groupBy}
        onChange={e => onGroupByChange(e.target.value as KanbanGroupBy)}
      >
        <option value="status">Status</option>
        <option value="member">Assigned to</option>
        <option value="member-combination">Assigned to (combo)</option>
      </select>

      <div className={divider} />

      {/* Sort by */}
      <span className={label}>Sort by</span>
      <select
        className={select}
        value={sortBy}
        onChange={e => onSortByChange(e.target.value as KanbanSortBy)}
      >
        <option value="startDate">Start date</option>
        <option value="endDate">End date</option>
        <option value="title">Title</option>
        <option value="percentComplete">% Complete</option>
        <option value="updatedAt">Recently updated</option>
      </select>

      <div className={divider} />

      {/* Color by */}
      <span className={label}>Color by</span>
      <select
        className={select}
        value={colorBy}
        onChange={e => onColorByChange(e.target.value as ColorBy)}
      >
        <option value="activity">Activity</option>
        <option value="member">Member</option>
        <option value="status">Status</option>
      </select>

      <div className={divider} />

      {/* Card fields multi-select */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          className={btn}
          onClick={() => setCardFieldsOpen(o => !o)}
          title="Configure card fields"
        >
          Card fields
          {activeFieldCount > 0 && (
            <span
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                borderRadius: 9,
                fontSize: 10,
                fontWeight: 700,
                padding: '0 5px',
                lineHeight: '16px',
              }}
            >
              {activeFieldCount}
            </span>
          )}
          <ChevronDown size={11} strokeWidth={2} />
        </button>

        {cardFieldsOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              zIndex: 50,
              minWidth: 160,
              padding: '4px 0',
            }}
          >
            {ALL_CARD_FIELDS.map(f => {
              const checked = cardFields.includes(f.id);
              return (
                <button
                  key={f.id}
                  onClick={() => toggleField(f.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--foreground)',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: '1.5px solid var(--border)',
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: checked ? 'var(--primary)' : 'transparent',
                      borderColor: checked ? 'var(--primary)' : 'var(--border)',
                      flexShrink: 0,
                    }}
                  >
                    {checked && <Check size={9} strokeWidth={3} color="var(--primary-foreground)" />}
                  </span>
                  {f.label}
                </button>
              );
            })}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <button
              onClick={() => onCardFieldsChange(DEFAULT_CARD_FIELDS)}
              style={{
                display: 'flex',
                width: '100%',
                padding: '6px 12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 11,
                color: 'var(--muted-foreground)',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </div>

      <div className={divider} />

      {/* Hierarchy toggle */}
      <button
        className={btn}
        onClick={() => onShowHierarchyChange(!showHierarchy)}
        title={showHierarchy
          ? 'Hierarchy on: child activities nest under their parent. Click to show flat list.'
          : 'Hierarchy off: all activities shown at top level. Click to nest children under parents.'}
        style={{
          background: showHierarchy ? 'var(--primary)' : undefined,
          color: showHierarchy ? 'var(--primary-foreground)' : undefined,
          borderColor: showHierarchy ? 'var(--primary)' : undefined,
        }}
      >
        <Network size={12} strokeWidth={1.8} />
        Hierarchy
      </button>

      {/* Export + share — pushed to the right */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className={divider} />
        <button className={btn} onClick={onExport} title="Export activities">
          <Download size={12} strokeWidth={1.8} />
          Export
        </button>
        <button className={btn} onClick={onShare} title="Share this view">
          <Share2 size={12} strokeWidth={1.8} />
          Share
        </button>
      </div>
    </div>
  );
}
