/**
 * Unified filter management modal. Replaces the FilterManagePanel and
 * FilterEditor sidebars with a single dialog for creating, editing,
 * duplicating, promoting, and demoting saved filters.
 */

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { components } from '@draba/shared'
import type { FilterCondition, FilterDefinition } from '@/lib/filterTypes'
import {
  useSavedFilters,
  useAllTeamSavedFilters,
  useCreateSavedFilter,
  useUpdateSavedFilter,
  useDeleteSavedFilter,
} from '@/hooks/useSavedFilters'
import { useTeamMembers } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import { useTags } from '@/hooks/useTags'
import { useAuth } from '@/contexts/AuthContext'
import FilterConditionRow from './FilterConditionRow'
import {
  Filter, X, Plus, ArrowLeft, Eye, Pencil, Trash2, Copy,
  Globe, Lock, Users, AlertCircle, ArrowUp, Search, Check,
} from 'lucide-react'

type SavedFilter = components['schemas']['SavedFilter']

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'mine' | 'team' | 'members'
type EditorMode = 'new' | 'edit' | 'view'

interface EditorState {
  mode: EditorMode
  filter?: SavedFilter
  readOnly: boolean
}

// ���─ Helpers ───────────────────────────────────────────────────────────────────

function makeBlank(): FilterCondition {
  return { field: 'title', op: 'contains', value: '' }
}

function summarize(filter: SavedFilter): string {
  try {
    const def = JSON.parse(filter.definition) as FilterDefinition
    if (!def.conditions?.length) return ''
    const sep = def.logic === 'or' ? ' or ' : ' and '
    return def.conditions
      .map(c => `${c.field} ${String(c.op).replace(/_/g, ' ')}`)
      .join(sep)
  } catch { return '' }
}

function parseDraft(filter: SavedFilter): { logic: 'and' | 'or'; conditions: FilterCondition[] } {
  try {
    const def = JSON.parse(filter.definition) as FilterDefinition
    return {
      logic: def.logic ?? 'and',
      conditions: def.conditions?.length ? def.conditions : [makeBlank()],
    }
  } catch {
    return { logic: 'and', conditions: [makeBlank()] }
  }
}

// ─��� Shared styles ─────────────────────────────────────────────────────────────

const ICON_BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--muted-foreground)',
  flexShrink: 0,
  fontFamily: 'var(--font-sans)',
}

const BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '5px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  background: 'transparent',
  color: 'var(--foreground)',
  transition: 'all 0.1s',
}

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN,
  background: 'var(--primary)',
  color: 'white',
  border: 'none',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN,
  color: 'var(--destructive)',
  borderColor: 'rgba(239,68,68,.4)',
}

const BTN_PROMOTE: React.CSSProperties = {
  ...BTN,
  color: '#5B69E0',
  borderColor: 'rgba(91,105,224,.35)',
}

// ── ScopePill ─────────────────────────────────────────────────────────────────

function ScopePill({ isTeam }: { isTeam: boolean }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '2px 7px',
      borderRadius: 99,
      fontSize: 10,
      fontWeight: 700,
      background: isTeam ? 'rgba(40,140,155,.1)' : 'var(--muted)',
      color: isTeam ? 'var(--primary)' : 'var(--muted-foreground)',
      border: `1px solid ${isTeam ? 'rgba(40,140,155,.28)' : 'var(--border)'}`,
      flexShrink: 0,
    }}>
      {isTeam
        ? <Globe size={9} strokeWidth={2} />
        : <Lock size={9} strokeWidth={2} />}
      {isTeam ? 'Team' : 'Private'}
    </span>
  )
}

// ── FilterRow ─────────────────────────────────────────────────────────────────

interface FilterRowProps {
  filter: SavedFilter
  currentUserId: string
  isAdmin: boolean
  /** Determines which action set to show. */
  context: 'mine' | 'team' | 'member-admin'
  onEdit?: () => void
  onView?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onPromote?: () => void
  onDemote?: () => void
  ownerLabel?: string
}

function FilterRow({
  filter, currentUserId, isAdmin, context,
  onEdit, onView, onDuplicate, onDelete, onPromote, onDemote,
  ownerLabel,
}: FilterRowProps) {
  const [hovered, setHovered] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const summary = summarize(filter)
  // member-admin always shows actions; others reveal on hover
  const showActions = context === 'member-admin' || hovered

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDel(false) }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 8,
        background: 'var(--card)',
        border: `1px solid ${hovered ? 'rgba(0,0,0,.1)' : 'var(--border)'}`,
        transition: 'background 0.08s, border-color 0.08s',
      }}
    >
      {/* Icon tile */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: filter.isTeamFilter ? 'rgba(40,140,155,.1)' : 'var(--muted)',
        border: `1px solid ${filter.isTeamFilter ? 'rgba(40,140,155,.25)' : 'var(--border)'}`,
        color: filter.isTeamFilter ? 'var(--primary)' : 'var(--muted-foreground)',
        marginTop: 1,
      }}>
        <Filter size={12} strokeWidth={1.8} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {filter.name}
          </span>
          <ScopePill isTeam={filter.isTeamFilter} />
          {ownerLabel && (
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              by {filter.userId === currentUserId ? 'you' : ownerLabel}
            </span>
          )}
        </div>
        {summary && (
          <div style={{
            fontSize: 11,
            color: 'var(--muted-foreground)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {summary}
          </div>
        )}

        {/* Actions */}
        {!confirmDel && (
          <div style={{
            display: 'flex',
            gap: 5,
            marginTop: 6,
            flexWrap: 'wrap',
            opacity: showActions ? 1 : 0,
            transition: 'opacity 0.1s',
          }}>
            {context === 'member-admin' && (
              <>
                <button onClick={onView} style={ICON_BTN} title="View filter">
                  <Eye size={12} strokeWidth={1.8} />
                </button>
                <button onClick={onPromote} style={BTN_PROMOTE}>
                  <ArrowUp size={11} strokeWidth={2} />
                  Promote to team
                </button>
              </>
            )}
            {context === 'team' && (
              isAdmin ? (
                <>
                  <button onClick={onEdit} style={ICON_BTN} title="Edit">
                    <Pencil size={12} strokeWidth={1.8} />
                  </button>
                  <button onClick={onDemote} style={ICON_BTN} title="Remove from team">
                    <Lock size={12} strokeWidth={1.8} />
                  </button>
                  <button
                    onClick={() => setConfirmDel(true)}
                    style={{ ...ICON_BTN, color: 'var(--destructive)' }}
                    title="Delete"
                  >
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                </>
              ) : (
                <button onClick={onView} style={ICON_BTN} title="View filter">
                  <Eye size={12} strokeWidth={1.8} />
                </button>
              )
            )}
            {context === 'mine' && (
              <>
                <button onClick={onDuplicate} style={ICON_BTN} title="Duplicate">
                  <Copy size={12} strokeWidth={1.8} />
                </button>
                <button onClick={onEdit} style={ICON_BTN} title="Edit">
                  <Pencil size={12} strokeWidth={1.8} />
                </button>
                {isAdmin && (
                  <button onClick={onPromote} style={BTN_PROMOTE}>
                    <ArrowUp size={11} strokeWidth={2} />
                    Promote
                  </button>
                )}
                <button
                  onClick={() => setConfirmDel(true)}
                  style={{ ...ICON_BTN, color: 'var(--destructive)' }}
                  title="Delete"
                >
                  <Trash2 size={12} strokeWidth={1.8} />
                </button>
              </>
            )}
          </div>
        )}

        {confirmDel && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flex: 1 }}>
              Delete "{filter.name}"?
            </span>
            <button onClick={() => setConfirmDel(false)} style={BTN}>Cancel</button>
            <button
              onClick={() => { setConfirmDel(false); onDelete?.() }}
              style={{ ...BTN, background: 'var(--destructive)', color: 'white', border: 'none' }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, onAction, actionLabel }: {
  icon: React.ReactNode
  title: string
  body: string
  onAction?: () => void
  actionLabel?: string
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 24px',
      border: '1px dashed var(--border)',
      borderRadius: 10,
      textAlign: 'center',
      gap: 8,
      color: 'var(--muted-foreground)',
    }}>
      <div style={{ marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{title}</div>
      <div style={{ fontSize: 12, maxWidth: 280 }}>{body}</div>
      {onAction && actionLabel && (
        <button onClick={onAction} style={{ ...BTN_PRIMARY, marginTop: 4 }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface FilterManageModalProps {
  open: boolean
  onClose: () => void
  teamId: string
  timelineId: string
  isAdmin: boolean
}

export default function FilterManageModal({
  open,
  onClose,
  teamId,
  timelineId,
  isAdmin,
}: FilterManageModalProps) {
  const { user } = useAuth()
  const currentUserId = (user as { id?: string } | null)?.id ?? ''

  // Data
  const { data: filters = [] } = useSavedFilters(teamId)
  const { data: allFilters = [] } = useAllTeamSavedFilters(teamId, isAdmin && open)
  const { data: members = [] } = useTeamMembers(teamId)
  const { data: tags = [] } = useTags(teamId)
  const { data: statuses = [] } = useTimelineStatuses(teamId, timelineId)

  const statusOptions = useMemo(() => {
    const seen = new Set<string>()
    return statuses
      .filter(s => {
        const k = s.name.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .map(s => ({ value: s.name, label: s.name }))
  }, [statuses])

  // Mutations
  const createFilter = useCreateSavedFilter(teamId)
  const updateFilter = useUpdateSavedFilter(teamId)
  const deleteFilter = useDeleteSavedFilter(teamId)

  // Modal state
  const [tab, setTab] = useState<TabId>('mine')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)

  // Editor draft state
  const [draftName, setDraftName] = useState('')
  const [draftLogic, setDraftLogic] = useState<'and' | 'or'>('and')
  const [draftConditions, setDraftConditions] = useState<FilterCondition[]>([makeBlank()])

  // Derived filter lists
  const myFilters = filters.filter(f => f.userId === currentUserId && !f.isTeamFilter)
  const teamFilters = filters.filter(f => f.isTeamFilter)
  const memberPrivateFilters = allFilters.filter(f => !f.isTeamFilter)

  // Group member filters by owner
  const memberGroups = useMemo(() => {
    const groups = new Map<string, SavedFilter[]>()
    memberPrivateFilters.forEach(f => {
      const g = groups.get(f.userId) ?? []
      g.push(f)
      groups.set(f.userId, g)
    })
    return groups
  }, [memberPrivateFilters])

  // Build userId → display name map
  const memberNameById = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach(m => {
      if (m.userId) map.set(m.userId, m.displayName || m.email || 'Unknown')
    })
    return map
  }, [members])

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // Escape key: close editor first, then modal
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (editor) setEditor(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, editor, onClose])

  // ── Editor helpers ──────────────────────────────────────────────────────────

  function openNew() {
    setDraftName('')
    setDraftLogic('and')
    setDraftConditions([makeBlank()])
    setEditorError(null)
    setEditor({ mode: 'new', readOnly: false })
  }

  function openEdit(filter: SavedFilter) {
    const { logic, conditions } = parseDraft(filter)
    setDraftName(filter.name)
    setDraftLogic(logic)
    setDraftConditions(conditions)
    setEditorError(null)
    setEditor({ mode: 'edit', filter, readOnly: false })
  }

  function openView(filter: SavedFilter) {
    const { logic, conditions } = parseDraft(filter)
    setDraftName(filter.name)
    setDraftLogic(logic)
    setDraftConditions(conditions)
    setEditorError(null)
    setEditor({ mode: 'view', filter, readOnly: true })
  }

  async function handleSave() {
    if (!draftName.trim()) { setEditorError('Filter name is required.'); return }
    setEditorError(null)
    const definition = JSON.stringify({ logic: draftLogic, conditions: draftConditions } as FilterDefinition)
    try {
      if (editor?.mode === 'edit' && editor.filter) {
        await updateFilter.mutateAsync({ id: editor.filter.id, name: draftName.trim(), definition })
        setToast(`"${draftName.trim()}" updated.`)
      } else {
        await createFilter.mutateAsync({ name: draftName.trim(), definition })
        setToast(`"${draftName.trim()}" created.`)
      }
      setEditor(null)
    } catch {
      setEditorError('Failed to save. Please try again.')
    }
  }

  async function handleDelete(filter: SavedFilter) {
    try {
      await deleteFilter.mutateAsync(filter.id)
      setToast(`"${filter.name}" deleted.`)
    } catch {
      setToast('Delete failed.')
    }
  }

  async function handleDuplicate(filter: SavedFilter) {
    try {
      await createFilter.mutateAsync({
        name: `${filter.name} copy`,
        definition: filter.definition,
      })
      setToast(`Duplicated "${filter.name}".`)
    } catch {
      setToast('Duplicate failed.')
    }
  }

  async function handlePromote(filter: SavedFilter) {
    try {
      await updateFilter.mutateAsync({ id: filter.id, isTeamFilter: true })
      setToast(`"${filter.name}" promoted to Team filters.`)
      setEditor(null)
      setTab('team')
    } catch {
      setToast('Promote failed.')
    }
  }

  async function handleDemote(filter: SavedFilter) {
    try {
      await updateFilter.mutateAsync({ id: filter.id, isTeamFilter: false })
      setToast(`"${filter.name}" removed from Team filters.`)
      setEditor(null)
    } catch {
      setToast('Failed to remove from team.')
    }
  }

  const isSaving = createFilter.isPending || updateFilter.isPending

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          position: 'relative',
          width: 700,
          maxWidth: '100%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(40,140,155,.1)',
            border: '1px solid rgba(40,140,155,.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Filter size={15} strokeWidth={1.8} color="var(--primary)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>Filters</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              Manage, build, and share your timeline filters
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ ...ICON_BTN, border: 'none' }}
            title="Close"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {/* ── Tab bar (list mode only) ─────────────────────────────────────── */}
        {!editor && (
          <div style={{
            padding: '0 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexShrink: 0,
          }}>
            {([
              { id: 'mine' as TabId, label: 'My filters' },
              { id: 'team' as TabId, label: 'Team filters', teamBadge: true },
              ...(isAdmin ? [{ id: 'members' as TabId, label: "Members' filters", count: memberPrivateFilters.length }] : []),
            ]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontFamily: 'var(--font-sans)',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.1s, border-color 0.1s',
                }}
              >
                {t.label}
                {'teamBadge' in t && t.teamBadge && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'rgba(40,140,155,.1)',
                    border: '1px solid rgba(40,140,155,.25)',
                    borderRadius: 99,
                    padding: '1px 5px',
                  }}>
                    Team
                  </span>
                )}
                {'count' in t && typeof t.count === 'number' && t.count > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: 'var(--muted)',
                    borderRadius: 99,
                    padding: '1px 6px',
                    color: 'var(--muted-foreground)',
                  }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ── Editor sub-header ────────────────────────────────────────────── */}
        {editor && (
          <div style={{
            padding: '10px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <button onClick={() => setEditor(null)} style={ICON_BTN} title="Back">
              <ArrowLeft size={14} strokeWidth={2} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--muted-foreground)',
                letterSpacing: '0.6px',
                textTransform: 'uppercase',
              }}>
                {editor.mode === 'new' ? 'New filter' : editor.mode === 'edit' ? 'Edit filter' : 'Filter details'}
              </div>
              {editor.filter && (
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  marginTop: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {editor.filter.name}
                </div>
              )}
            </div>
            <ScopePill isTeam={Boolean(editor.filter?.isTeamFilter)} />
          </div>
        )}

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* List mode */}
          {!editor && tab === 'mine' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                gap: 12,
              }}>
                <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
                  Private filters only you can see.
                </p>
                <button onClick={openNew} style={BTN_PRIMARY}>
                  <Plus size={12} strokeWidth={2} />
                  New filter
                </button>
              </div>
              {myFilters.length === 0 ? (
                <EmptyState
                  icon={<Filter size={32} strokeWidth={1.2} />}
                  title="No filters yet"
                  body="Create a filter to quickly focus on the activities that matter to you."
                  onAction={openNew}
                  actionLabel="Create your first filter"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {myFilters.map(f => (
                    <FilterRow
                      key={f.id}
                      filter={f}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      context="mine"
                      onEdit={() => openEdit(f)}
                      onView={() => openView(f)}
                      onDuplicate={() => handleDuplicate(f)}
                      onDelete={() => handleDelete(f)}
                      onPromote={() => handlePromote(f)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!editor && tab === 'team' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
                Shared with everyone — these appear in every member's filter dropdown.{' '}
                {isAdmin
                  ? 'As an admin you can edit, demote, or remove them.'
                  : 'Only team admins can change them.'}
              </p>
              {teamFilters.length === 0 ? (
                <EmptyState
                  icon={<Globe size={32} strokeWidth={1.2} />}
                  title="No team filters"
                  body={
                    isAdmin
                      ? 'Promote a member filter to make it available to everyone.'
                      : 'Team admins can promote filters to share them here.'
                  }
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teamFilters.map(f => (
                    <FilterRow
                      key={f.id}
                      filter={f}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      context="team"
                      onEdit={() => openEdit(f)}
                      onView={() => openView(f)}
                      onDelete={() => handleDelete(f)}
                      onDemote={() => handleDemote(f)}
                      ownerLabel={memberNameById.get(f.userId)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!editor && tab === 'members' && isAdmin && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 10 }}>
                Every member's private filters. Promote any to a{' '}
                <strong>Team filter</strong> to share it with the whole team.
              </p>

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search
                  size={13}
                  strokeWidth={1.8}
                  style={{
                    position: 'absolute',
                    left: 9,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted-foreground)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by member or filter name…"
                  style={{
                    width: '100%',
                    padding: '6px 8px 6px 28px',
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    background: 'var(--background)',
                    color: 'var(--foreground)',
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {memberGroups.size === 0 ? (
                <EmptyState
                  icon={<Users size={32} strokeWidth={1.2} />}
                  title="No private filters"
                  body="Members haven't created any private filters yet."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Array.from(memberGroups.entries()).map(([userId, filts]) => {
                    const name = memberNameById.get(userId) ?? 'Unknown member'
                    const q = search.toLowerCase()
                    const visible = filts.filter(f =>
                      !q || name.toLowerCase().includes(q) || f.name.toLowerCase().includes(q),
                    )
                    if (visible.length === 0) return null
                    return (
                      <div key={userId}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                        }}>
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: 99,
                            background: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 700,
                            color: 'white',
                            flexShrink: 0,
                          }}>
                            {(name[0] ?? '?').toUpperCase()}
                          </div>
                          {userId === currentUserId ? `${name} (you)` : name}
                          <span style={{
                            fontSize: 10,
                            fontWeight: 600,
                            background: 'var(--muted)',
                            borderRadius: 99,
                            padding: '1px 6px',
                            color: 'var(--muted-foreground)',
                          }}>
                            {visible.length}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {visible.map(f => (
                            <FilterRow
                              key={f.id}
                              filter={f}
                              currentUserId={currentUserId}
                              isAdmin={isAdmin}
                              context="member-admin"
                              onView={() => openView(f)}
                              onPromote={() => handlePromote(f)}
                              onDelete={() => handleDelete(f)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {memberPrivateFilters.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 7,
                  marginTop: 16,
                  padding: '9px 12px',
                  background: 'var(--muted)',
                  borderRadius: 7,
                  fontSize: 11,
                  color: 'var(--muted-foreground)',
                }}>
                  <AlertCircle size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {memberPrivateFilters.length} private filter
                    {memberPrivateFilters.length !== 1 ? 's' : ''} across the team.
                    Promoting moves a filter into Team filters for everyone; you can remove it any time.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Editor mode */}
          {editor && (
            <div>
              {editor.readOnly && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--muted)',
                  borderRadius: 7,
                  marginBottom: 16,
                  fontSize: 12,
                  color: 'var(--muted-foreground)',
                }}>
                  <Eye size={13} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  Read-only —{' '}
                  {editor.filter?.isTeamFilter
                    ? 'only team admins can edit team filters.'
                    : 'this filter belongs to another member.'}
                </div>
              )}

              <div style={{
                pointerEvents: editor.readOnly ? 'none' : undefined,
                opacity: editor.readOnly ? 0.85 : 1,
              }}>
                {/* Name */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--muted-foreground)',
                    letterSpacing: '0.6px',
                    textTransform: 'uppercase',
                    marginBottom: 5,
                  }}>
                    Filter name
                  </label>
                  <input
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="e.g. My open tasks"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={!editor.readOnly}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--background)',
                      color: 'var(--foreground)',
                      fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Match toggle */}
                <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Match</span>
                  <div style={{
                    display: 'flex',
                    background: 'var(--muted)',
                    borderRadius: 6,
                    padding: 2,
                    border: '1px solid var(--border)',
                  }}>
                    {(['and', 'or'] as const).map(l => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setDraftLogic(l)}
                        style={{
                          padding: '3px 10px',
                          border: 'none',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-sans)',
                          background: draftLogic === l ? 'var(--primary)' : 'transparent',
                          color: draftLogic === l ? 'white' : 'var(--muted-foreground)',
                          transition: 'all 0.1s',
                        }}
                      >
                        {l === 'and' ? 'All' : 'Any'}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>of the following conditions</span>
                </div>

                {/* Conditions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {draftConditions.map((c, i) => (
                    <FilterConditionRow
                      key={i}
                      condition={c}
                      statusOptions={statusOptions}
                      tags={tags}
                      members={members}
                      onChange={next =>
                        setDraftConditions(prev => prev.map((x, j) => j === i ? next : x))
                      }
                      onRemove={() =>
                        setDraftConditions(prev => {
                          const next = prev.filter((_, j) => j !== i)
                          return next.length ? next : [makeBlank()]
                        })
                      }
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setDraftConditions(prev => [...prev, makeBlank()])}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    border: '1px dashed var(--border)',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <Plus size={12} strokeWidth={2} />
                  Add condition
                </button>
              </div>

              {editorError && (
                <div style={{ fontSize: 12, color: 'var(--destructive)', marginTop: 10 }}>
                  {editorError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: 8,
        }}>
          {!editor ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                {teamFilters.length} team · {myFilters.length} private
              </span>
              <button onClick={onClose} style={BTN_PRIMARY}>Done</button>
            </>
          ) : (
            <>
              {/* Left cluster — destructive / scope actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                {editor.mode === 'edit' && editor.filter && !editor.readOnly && (
                  <button
                    onClick={async () => {
                      if (!editor.filter) return
                      await handleDelete(editor.filter)
                      setEditor(null)
                    }}
                    style={BTN_DANGER}
                  >
                    <Trash2 size={11} strokeWidth={2} />
                    Delete
                  </button>
                )}
                {editor.mode === 'edit' && editor.filter && isAdmin && !editor.filter.isTeamFilter && (
                  <button onClick={() => editor.filter && handlePromote(editor.filter)} style={BTN_PROMOTE}>
                    <ArrowUp size={11} strokeWidth={2} />
                    Promote to team
                  </button>
                )}
                {editor.mode === 'edit' && editor.filter?.isTeamFilter && isAdmin && (
                  <button onClick={() => editor.filter && handleDemote(editor.filter)} style={BTN}>
                    <Lock size={11} strokeWidth={2} />
                    Remove from team
                  </button>
                )}
              </div>

              {/* Right cluster */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditor(null)} style={BTN}>
                  {editor.readOnly ? 'Back' : 'Cancel'}
                </button>
                {!editor.readOnly && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !draftName.trim()}
                    style={{
                      ...BTN_PRIMARY,
                      opacity: isSaving || !draftName.trim() ? 0.6 : 1,
                      cursor: isSaving || !draftName.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Check size={12} strokeWidth={2.5} />
                    {isSaving ? 'Saving…' : editor.mode === 'new' ? 'Create filter' : 'Save changes'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Toast ───────────────────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 99,
            padding: '7px 16px',
            fontSize: 12,
            color: 'var(--foreground)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 1001,
          }}>
            <Check size={13} strokeWidth={2.5} color="var(--primary)" />
            {toast}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
