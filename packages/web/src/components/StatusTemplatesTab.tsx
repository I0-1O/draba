/**
 * StatusTemplatesTab — Status Templates management inside the Team Modal.
 *
 * Shows a list of status templates for the team. Each template can be expanded
 * to reveal its items, which can be edited, reordered (positionally), added,
 * or removed. Admins can also create and delete templates, with the server
 * blocking deletion of the last template or last item.
 */

import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import {
  useStatusTemplates,
  useCreateStatusTemplate,
  useUpdateStatusTemplate,
  useDeleteStatusTemplate,
  useCreateTemplateItem,
  useUpdateTemplateItem,
  useDeleteTemplateItem,
} from '@/hooks/useStatusTemplates'
import type { components } from '@draba/shared'

type StatusTemplate = components['schemas']['StatusTemplate']
type StatusTemplateItem = components['schemas']['StatusTemplateItem']

interface Props {
  teamId: string
  isAdmin: boolean
  teamColor: string
}

// ── Colour swatches shown in the item editor ────────────────────────────────

const ITEM_COLORS = [
  '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6',
  '#14B8A6', '#F97316', '#EC4899', '#6B7280', '#e6edf3',
]

// ── Item row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: StatusTemplateItem
  teamId: string
  canDelete: boolean
}

function ItemRow({ item, teamId, canDelete }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [color, setColor] = useState(item.color)
  const [isClosed, setIsClosed] = useState(item.isClosed)
  const updateItem = useUpdateTemplateItem(teamId)
  const deleteItem = useDeleteTemplateItem(teamId)
  const [error, setError] = useState('')

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    updateItem.mutate(
      { id: item.id, name: name.trim(), color, isClosed },
      {
        onSuccess: () => setEditing(false),
        onError: () => setError('Failed to save'),
      }
    )
  }

  function handleDelete() {
    if (!canDelete) { setError('Cannot delete the last item'); return }
    deleteItem.mutate(item.id, {
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to delete'
        setError(msg.includes('LAST_ITEM') ? 'Cannot delete the last item' : msg)
      },
    })
  }

  if (editing) {
    return (
      <div style={{ background: '#2d333b', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: color, flexShrink: 0 }} />
          <input
            autoFocus
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '5px 8px', color: '#e6edf3', fontSize: 13, fontFamily: 'inherit' }}
          />
          <button onClick={handleSave} disabled={updateItem.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', display: 'flex', padding: 2 }}>
            <Check size={15} />
          </button>
          <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', display: 'flex', padding: 2 }}>
            <X size={15} />
          </button>
        </div>
        {/* Colour swatches */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ITEM_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 20, height: 20, borderRadius: 4, background: c, border: 'none', cursor: 'pointer',
                outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
              }}
            />
          ))}
        </div>
        {/* is_closed toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b949e', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={isClosed}
            onChange={e => setIsClosed(e.target.checked)}
            style={{ accentColor: '#3B82F6' }}
          />
          Closed status (hides from active views when "Hide closed" filter is on)
        </label>
        {error && <div style={{ fontSize: 11, color: '#ef4444' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px',
      borderRadius: 6,
    }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }} />
      <span
        onClick={() => setEditing(true)}
        style={{ flex: 1, fontSize: 13, color: '#e6edf3', cursor: 'pointer' }}
        title="Click to edit"
      >
        {item.name}
      </span>
      {item.isClosed && (
        <span style={{ fontSize: 10, color: '#484f58', background: '#161b22', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.3px' }}>
          closed
        </span>
      )}
      <button
        onClick={handleDelete}
        disabled={!canDelete || deleteItem.isPending}
        title={canDelete ? 'Remove item' : 'Cannot delete the last item'}
        style={{
          background: 'none', border: 'none', cursor: canDelete ? 'pointer' : 'not-allowed',
          color: '#484f58', display: 'flex', padding: 2, opacity: canDelete ? 1 : 0.35,
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: StatusTemplate
  teamId: string
  isAdmin: boolean
  teamColor: string
  canDelete: boolean
}

function TemplateCard({ template, teamId, isAdmin, teamColor, canDelete }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemColor, setNewItemColor] = useState('#3B82F6')
  const [itemError, setItemError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const createItem = useCreateTemplateItem(teamId)
  const deleteTemplate = useDeleteStatusTemplate(teamId)

  function handleAddItem() {
    if (!newItemName.trim()) { setItemError('Name is required'); return }
    createItem.mutate(
      { templateId: template.id, name: newItemName.trim(), color: newItemColor },
      {
        onSuccess: () => { setNewItemName(''); setNewItemColor('#3B82F6'); setAddingItem(false) },
        onError: () => setItemError('Failed to add item'),
      }
    )
  }

  function handleDeleteTemplate() {
    if (!canDelete) { setDeleteError('Cannot delete the last template'); return }
    deleteTemplate.mutate(template.id, {
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to delete'
        setDeleteError(msg.includes('LAST_TEMPLATE') ? 'Cannot delete the last template' : msg)
      },
    })
  }

  return (
    <div style={{ border: '1px solid #30363d', borderRadius: 10, overflow: 'hidden' }}>
      {/* Template header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#2d333b' }}>
        <button
          onClick={() => setExpanded(x => !x)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b949e', display: 'flex', padding: 0 }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#e6edf3' }}>{template.name}</span>
        <span style={{ fontSize: 11, color: '#484f58' }}>{template.items.length} item{template.items.length !== 1 ? 's' : ''}</span>
        {isAdmin && canDelete && (
          <button
            onClick={handleDeleteTemplate}
            disabled={deleteTemplate.isPending}
            title="Delete template"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', display: 'flex', padding: 2 }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {deleteError && (
        <div style={{ padding: '4px 14px', fontSize: 11, color: '#ef4444', background: '#2d333b' }}>
          {deleteError}
        </div>
      )}

      {/* Template items */}
      {expanded && (
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {template.items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              teamId={teamId}
              canDelete={template.items.length > 1}
            />
          ))}

          {/* Add item row */}
          {isAdmin && (
            addingItem ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: newItemColor, flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={newItemName}
                    onChange={e => { setNewItemName(e.target.value); setItemError('') }}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItem(false) }}
                    placeholder="Status name…"
                    style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '5px 8px', color: '#e6edf3', fontSize: 13, fontFamily: 'inherit' }}
                  />
                  <button onClick={handleAddItem} disabled={createItem.isPending} style={{ background: 'none', border: 'none', cursor: 'pointer', color: teamColor, display: 'flex', padding: 2 }}>
                    <Check size={15} />
                  </button>
                  <button onClick={() => setAddingItem(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484f58', display: 'flex', padding: 2 }}>
                    <X size={15} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 20 }}>
                  {ITEM_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewItemColor(c)}
                      style={{
                        width: 18, height: 18, borderRadius: 3, background: c, border: 'none', cursor: 'pointer',
                        outline: newItemColor === c ? `2px solid ${c}` : 'none', outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
                {itemError && <div style={{ fontSize: 11, color: '#ef4444', paddingLeft: 20 }}>{itemError}</div>}
              </div>
            ) : (
              <button
                onClick={() => setAddingItem(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#484f58', fontSize: 12, padding: '4px 2px', fontFamily: 'inherit',
                }}
              >
                <Plus size={13} /> Add status
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function StatusTemplatesTab({ teamId, isAdmin, teamColor }: Props) {
  const { data: templates = [], isLoading } = useStatusTemplates(teamId)
  const createTemplate = useCreateStatusTemplate(teamId)
  const [addingTemplate, setAddingTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [createError, setCreateError] = useState('')

  function handleCreateTemplate() {
    if (!newTemplateName.trim()) { setCreateError('Name is required'); return }
    createTemplate.mutate(
      { name: newTemplateName.trim() },
      {
        onSuccess: () => { setNewTemplateName(''); setAddingTemplate(false) },
        onError: () => setCreateError('Failed to create template'),
      }
    )
  }

  if (isLoading) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: '#484f58' }}>Loading…</div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.6 }}>
        Status templates are reusable presets. When a new timeline is created, its statuses are
        copied from the first template. Changes here don't affect existing timelines.
      </div>

      {templates.map(template => (
        <TemplateCard
          key={template.id}
          template={template}
          teamId={teamId}
          isAdmin={isAdmin}
          teamColor={teamColor}
          canDelete={templates.length > 1}
        />
      ))}

      {/* Add template */}
      {isAdmin && (
        addingTemplate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                autoFocus
                value={newTemplateName}
                onChange={e => { setNewTemplateName(e.target.value); setCreateError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTemplate(); if (e.key === 'Escape') setAddingTemplate(false) }}
                placeholder="Template name (e.g. Kanban, Sprint)…"
                style={{
                  flex: 1, background: '#2d333b', border: '1px solid #30363d',
                  borderRadius: 7, padding: '8px 12px', color: '#e6edf3', fontSize: 13, fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleCreateTemplate}
                disabled={createTemplate.isPending}
                style={{
                  background: teamColor, border: 'none', borderRadius: 7, color: '#fff',
                  fontWeight: 600, fontSize: 13, padding: '8px 16px', cursor: 'pointer',
                  opacity: createTemplate.isPending ? 0.6 : 1, fontFamily: 'inherit',
                }}
              >
                {createTemplate.isPending ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setAddingTemplate(false)}
                style={{ background: 'none', border: '1px solid #30363d', borderRadius: 7, color: '#8b949e', fontSize: 13, padding: '8px 12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            {createError && <div style={{ fontSize: 11, color: '#ef4444' }}>{createError}</div>}
          </div>
        ) : (
          <button
            onClick={() => setAddingTemplate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
              background: 'none', border: '1px dashed #30363d', borderRadius: 8,
              color: '#484f58', fontSize: 13, padding: '10px 16px', cursor: 'pointer',
              fontFamily: 'inherit', width: '100%',
            }}
          >
            <Plus size={14} />
            New template
          </button>
        )
      )}
    </div>
  )
}
