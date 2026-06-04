/**
 * ActivityDetailPanel — right-side slide-in panel for a selected Gantt activity.
 *
 * Shares its field stack with ActivityCreatePanel via ActivityFieldsBody
 * (see shared/activityPanelFields.tsx) — header bar, footer, and save behavior live
 * here, the fields themselves are shared. Field order is fixed by the shared
 * body: Identity+Title → When → Description → Assigned to → Classify
 * (Status, Tags) → Advanced (Parent, Progress, Location, URL) → Notes.
 *
 * All functional fields save on change/blur via PATCH /activities/:id.
 * liveDragStart / liveDragEnd display live dates during bar drag without
 * triggering saves.
 */

import { useState, useEffect } from 'react'
import { X, Trash2, Archive, Loader2 } from 'lucide-react'
import type { Identity } from '@/components/identity/identity-constants'
import { useUpdateActivity, useDeleteActivity, useArchiveActivity, useTimelineActivities } from '@/hooks/useTeamActivities'
import { useTimelineStatuses } from '@/hooks/useStatusTemplates'
import { useTags } from '@/hooks/useTags'
import type { components } from '@draba/shared'
import type { Member } from '@/types'
import { ActivityFieldsBody, PANEL_WIDTH, toDateInput, toISODate } from '@/components/shared/activityPanelFields'

type ApiActivity = components['schemas']['Activity']

interface Props {
  event: ApiActivity | null
  open: boolean
  members: Member[]
  teamId: string
  timelineId: string
  onClose: () => void
  /** Display-only start date override during bar drag (YYYY-MM-DD). Does not trigger a save. */
  liveDragStart?: string
  /** Display-only end date override during bar drag (YYYY-MM-DD). Does not trigger a save. */
  liveDragEnd?: string
}

export default function ActivityDetailPanel({
  event, open, members, teamId, timelineId, onClose, liveDragStart, liveDragEnd,
}: Props) {
  const updateMutation = useUpdateActivity(timelineId)
  const deleteMutation = useDeleteActivity(timelineId)
  const archiveMutation = useArchiveActivity(timelineId)
  const { data: statuses = [] } = useTimelineStatuses(teamId, timelineId)
  const { data: teamTags = [] } = useTags(teamId)
  const { data: allActivities = [] } = useTimelineActivities(teamId, timelineId)

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [startDate, setStartDate] = useState(event ? toDateInput(event.startAt) : '')
  const [endDate, setEndDate] = useState(event ? toDateInput(event.endAt) : '')
  const [identity, setIdentity] = useState<Identity>({
    color: event?.color ?? '#288C9B',
    icon: event?.icon ?? '__none__',
  })
  const [assignedIds, setAssignedIds] = useState<string[]>(event?.assignedMemberIds ?? [])
  const [tagIds, setTagIds] = useState<string[]>((event?.tagIds as string[] | undefined) ?? [])
  const [location, setLocation] = useState(event?.location ?? '')
  const [url, setUrl] = useState(event?.url ?? '')
  const [progressValue, setProgressValue] = useState(event?.percentComplete ?? 0)
  // Parent and status are mirrored locally so the picker reflects a change
  // immediately — the `event` prop is a snapshot taken at selection time and
  // doesn't refresh until the activity is reselected.
  const [parentId, setParentId] = useState<string | null>(event?.parentActivityId ?? null)
  const [statusId, setStatusId] = useState<string | null>(event?.statusId ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Re-sync when the selected activity changes.
  useEffect(() => {
    if (!event) return
    setTitle(event.title)
    setDescription(event.description ?? '')
    setNotes(event.notes ?? '')
    setStartDate(toDateInput(event.startAt))
    setEndDate(toDateInput(event.endAt))
    setIdentity({ color: event.color ?? '#288C9B', icon: event.icon ?? '__none__' })
    setAssignedIds(event.assignedMemberIds ?? [])
    setTagIds((event.tagIds as string[] | undefined) ?? [])
    setLocation(event.location ?? '')
    setUrl(event.url ?? '')
    setProgressValue(event.percentComplete ?? 0)
    setParentId(event.parentActivityId ?? null)
    setStatusId(event.statusId ?? null)
    setConfirmDelete(false)
  }, [event?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local date state when the event's dates change (e.g. after a Gantt bar drag).
  const eventStartAt = event?.startAt
  const eventEndAt = event?.endAt
  useEffect(() => {
    if (eventStartAt) setStartDate(toDateInput(eventStartAt))
    if (eventEndAt) setEndDate(toDateInput(eventEndAt))
  }, [eventStartAt, eventEndAt])

  // Sync status when changed externally on the same activity (e.g. after a Kanban
  // drag-to-column). The main sync effect only fires on id change, so we need a
  // separate effect keyed on statusId.
  const eventStatusId = event?.statusId
  useEffect(() => {
    setStatusId(eventStatusId ?? null)
  }, [eventStatusId])

  // Sync assigned members when changed externally (e.g. after a Kanban drag to a
  // member column). Arrays compare by reference, so use a stable string key.
  const eventAssignedKey = (event?.assignedMemberIds ?? []).join(',')
  useEffect(() => {
    setAssignedIds(event?.assignedMemberIds ?? [])
  }, [eventAssignedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const saving = updateMutation.isPending
  const deleting = deleteMutation.isPending
  const archiving = archiveMutation.isPending

  // Display dates: live drag overrides take precedence while dragging.
  const displayStart = liveDragStart ?? startDate
  const displayEnd = liveDragEnd ?? endDate

  function save(patch: Parameters<typeof updateMutation.mutate>[0]['patch']) {
    if (!event) return
    updateMutation.mutate({ activityId: event.id, patch })
  }

  function handleTitleBlur() {
    if (title.trim() && title !== event?.title) save({ title: title.trim() })
  }

  function handleDescriptionBlur() {
    if (description !== (event?.description ?? '')) save({ description: description || null })
  }

  function handleNotesBlur() {
    if (notes !== (event?.notes ?? '')) save({ notes: notes || null } as Parameters<typeof save>[0])
  }

  function handleLocationBlur() {
    if (location !== (event?.location ?? '')) save({ location: location || null })
  }

  function handleUrlBlur() {
    if (url !== (event?.url ?? '')) save({ url: url || null })
  }

  function handleStartDateChange(val: string) {
    setStartDate(val)
    if (val && val <= endDate) save({ startAt: toISODate(val) })
  }

  function handleEndDateChange(val: string) {
    setEndDate(val)
    if (val && val >= startDate) save({ endAt: toISODate(val) })
  }

  function handleIdentityChange(next: Identity) {
    setIdentity(next)
    save({ color: next.color, icon: next.icon })
  }

  function toggleAssignee(memberId: string) {
    const next = assignedIds.includes(memberId)
      ? assignedIds.filter(id => id !== memberId)
      : [...assignedIds, memberId]
    setAssignedIds(next)
    save({ assignedMemberIds: next })
  }

  function handleTagsChange(ids: string[]) {
    setTagIds(ids)
    save({ tagIds: ids } as Parameters<typeof save>[0])
  }

  // Saves only on a real change. The shared ProgressRow already clamps to 0–100.
  function handleProgressCommit(clamped: number) {
    setProgressValue(clamped)
    if (clamped !== (event?.percentComplete ?? 0)) {
      save({ percentComplete: clamped } as Parameters<typeof save>[0])
    }
  }

  function handleDelete() {
    if (!event) return
    deleteMutation.mutate(event.id, { onSuccess: onClose })
  }

  function handleArchive() {
    if (!event) return
    archiveMutation.mutate(event.id, { onSuccess: onClose })
  }

  return (
    <div
      style={{
        width: open ? PANEL_WIDTH : 0,
        flexShrink: 0,
        borderLeft: open ? '1px solid var(--border)' : 'none',
        background: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      <div style={{ width: PANEL_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {!event ? null : (<>

        {/* ── Header bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', height: 'var(--topbar-h, 40px)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Activity detail</span>
            {saving && <Loader2 size={11} style={{ opacity: 0.5 }} className="animate-spin" />}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, border: 'none', background: 'none', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--muted-foreground)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* ── Scrollable body (shared with create panel) ── */}
        <ActivityFieldsBody
          identity={identity}
          onIdentityChange={handleIdentityChange}
          title={title}
          onTitleChange={setTitle}
          onTitleBlur={handleTitleBlur}
          titleFallbackName={event.title || ''}
          startDate={displayStart}
          endDate={displayEnd}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          description={description}
          onDescriptionChange={setDescription}
          onDescriptionBlur={handleDescriptionBlur}
          members={members}
          assignedIds={assignedIds}
          onToggleAssignee={toggleAssignee}
          statuses={statuses}
          statusId={statusId}
          onStatusChange={id => { setStatusId(id); save({ statusId: id } as Parameters<typeof save>[0]) }}
          teamId={teamId}
          teamTags={teamTags}
          tagIds={tagIds}
          onTagsChange={handleTagsChange}
          parentActivities={allActivities.filter(a => a.id !== event.id)}
          parentId={parentId}
          onParentChange={id => { setParentId(id); save({ parentActivityId: id } as Parameters<typeof save>[0]) }}
          progress={progressValue}
          onProgressCommit={handleProgressCommit}
          location={location}
          onLocationChange={setLocation}
          onLocationBlur={handleLocationBlur}
          url={url}
          onUrlChange={setUrl}
          onUrlBlur={handleUrlBlur}
          notes={notes}
          onNotesChange={setNotes}
          onNotesBlur={handleNotesBlur}
        />

        {/* ── Footer — Archive + Delete buttons ── */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {confirmDelete ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, lineHeight: 1.4 }}>
                Delete <strong style={{ color: 'var(--foreground)' }}>{event?.title}</strong>? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 600, padding: 7,
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                    background: 'var(--card)', color: 'var(--foreground)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >Cancel</button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, fontSize: 12, fontWeight: 600, padding: 7,
                    borderRadius: 'var(--radius-md)', border: 'none',
                    background: 'var(--destructive)', color: 'white',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={handleArchive}
                disabled={archiving}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, padding: 7,
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  background: 'var(--card)', color: 'var(--muted-foreground)',
                  cursor: archiving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} strokeWidth={2} />}
                Archive
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  fontSize: 12, fontWeight: 600, padding: 7,
                  borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'hsl(0 72% 95%)', color: 'var(--destructive)',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                <Trash2 size={12} strokeWidth={2} />
                Delete
              </button>
            </div>
          )}
        </div>

        </>)}
      </div>
    </div>
  )
}
