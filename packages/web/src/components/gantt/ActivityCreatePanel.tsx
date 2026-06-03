/**
 * ActivityCreatePanel — right-side slide-in panel for creating a new Gantt activity.
 *
 * Shares its field stack with ActivityDetailPanel via ActivityFieldsBody
 * (see activityPanelFields.tsx) so the create and edit forms show an identical
 * field set and order. Unlike the detail panel, every change buffers in local
 * state; nothing persists until the user clicks "Create activity", which
 * submits the whole form via POST /timelines/:id/activities.
 *
 * Defaults come from the drag selection: start/end date and the lane member.
 */

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import type { Identity } from '@/components/identity/identity-constants'
import { useCreateActivity, useTimelineActivities } from '@/hooks/useTeamActivities'
import { useTags } from '@/hooks/useTags'
import type { Member } from '@/types'
import type { components } from '@draba/shared'
import { ActivityFieldsBody, PANEL_WIDTH } from './activityPanelFields'

type Status = components['schemas']['Status']

interface Props {
  open: boolean
  teamId: string
  timelineId: string
  members: Member[]
  timelineStatuses?: Status[]
  defaultStart: string
  defaultEnd: string
  defaultMemberId?: string | null
  defaultStatusId?: string | null
  onClose: () => void
}

export default function ActivityCreatePanel({
  open,
  teamId,
  timelineId,
  members,
  timelineStatuses = [],
  defaultStart,
  defaultEnd,
  defaultMemberId,
  defaultStatusId,
  onClose,
}: Props) {
  const createMutation = useCreateActivity(teamId, timelineId)
  const { data: teamTags = [] } = useTags(teamId)
  const { data: allActivities = [] } = useTimelineActivities(teamId, timelineId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [identity, setIdentity] = useState<Identity>({ color: '#288C9B', icon: '__none__' })
  const [assignedIds, setAssignedIds] = useState<string[]>(
    defaultMemberId ? [defaultMemberId] : [],
  )
  const [statusId, setStatusId] = useState<string | null>(defaultStatusId ?? null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [parentId, setParentId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [location, setLocation] = useState('')
  const [url, setUrl] = useState('')

  // Reset all fields to defaults each time the panel opens so re-opening
  // the panel always shows a blank form rather than the previous session's data.
  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setNotes('')
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setIdentity({ color: '#288C9B', icon: '__none__' })
    setAssignedIds(defaultMemberId ? [defaultMemberId] : [])
    setStatusId(defaultStatusId ?? null)
    setTagIds([])
    setParentId(null)
    setProgress(0)
    setLocation('')
    setUrl('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const creating = createMutation.isPending
  const titleTrimmed = title.trim()

  function toggleAssignee(memberId: string) {
    setAssignedIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId],
    )
  }

  // Keep the end date from drifting before the start date.
  function handleStartDateChange(val: string) {
    setStartDate(val)
    if (val > endDate) setEndDate(val)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titleTrimmed) return
    createMutation.mutate(
      {
        title: titleTrimmed,
        startAt: `${startDate}T00:00:00Z`,
        endAt: `${endDate}T00:00:00Z`,
        description: description.trim() || null,
        notes: notes.trim() || null,
        color: identity.color,
        icon: identity.icon,
        assignedMemberIds: assignedIds,
        statusId: statusId ?? undefined,
        tagIds,
        parentActivityId: parentId,
        percentComplete: progress,
        location: location.trim() || null,
        url: url.trim() || null,
      },
      { onSuccess: onClose },
    )
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
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 'var(--topbar-h, 40px)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>New activity</span>
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

      {/* Body (shared with detail panel) */}
      <ActivityFieldsBody
        identity={identity}
        onIdentityChange={setIdentity}
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Activity title…"
        titleAutoFocus
        titleFallbackName="New Activity"
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={setEndDate}
        description={description}
        onDescriptionChange={setDescription}
        members={members}
        assignedIds={assignedIds}
        onToggleAssignee={toggleAssignee}
        statuses={timelineStatuses}
        statusId={statusId}
        onStatusChange={setStatusId}
        teamId={teamId}
        teamTags={teamTags}
        tagIds={tagIds}
        onTagsChange={setTagIds}
        parentActivities={allActivities}
        parentId={parentId}
        onParentChange={setParentId}
        progress={progress}
        onProgressCommit={setProgress}
        location={location}
        onLocationChange={setLocation}
        url={url}
        onUrlChange={setUrl}
        notes={notes}
        onNotesChange={setNotes}
      />

      {/* Footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!titleTrimmed || creating}
          style={{
            width: '100%', fontSize: 13, fontWeight: 600, padding: 8,
            borderRadius: 'var(--radius-md)', border: 'none',
            background: titleTrimmed && !creating ? 'var(--primary)' : 'var(--muted)',
            color: titleTrimmed && !creating ? 'white' : 'var(--muted-foreground)',
            cursor: titleTrimmed && !creating ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.1s',
          }}
        >
          {creating && <Loader2 size={13} className="animate-spin" />}
          Create activity
        </button>
      </div>
    </div>
    </div>
  )
}
