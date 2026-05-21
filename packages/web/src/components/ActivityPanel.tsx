import { useEffect, useState } from 'react';
import { X, ArrowRight, Trash2 } from 'lucide-react';
import MemberAvatar from './MemberAvatar';
import type { DrabaActivity, ActivityStatus, Member } from '../types';
import { ACTIVITY_COLORS, STATUS_LABELS } from '../types';

interface Props {
  activity: DrabaActivity;
  members: Member[];
  onClose: () => void;
  onChange: (patch: Partial<DrabaActivity>) => void;
  onDelete?: () => void;
}

const FIELD_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--muted-foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 4,
};

/**
 * Right-side detail panel for a selected activity.
 *
 * Editing model:
 *  - `title` and `notes` use local state and commit on blur, so we don't
 *    fire an `onChange` for every keystroke.
 *  - `status` and `color` commit immediately (single discrete choice).
 *  - The effect resyncs local state when the selected activity changes
 *    (keyed on `activity.id`), otherwise stale text would persist when the
 *    user clicks a different activity.
 */
export default function ActivityPanel({ activity, members, onClose, onChange, onDelete }: Props) {
  const member = members.find(m => m.id === activity.memberId);
  const [title, setTitle] = useState(activity.title);
  const [notes, setNotes] = useState(activity.notes ?? '');
  const [status, setStatus] = useState<ActivityStatus>(activity.status);

  // Reset local edits when the panel switches to a different activity.
  useEffect(() => {
    setTitle(activity.title);
    setNotes(activity.notes ?? '');
    setStatus(activity.status);
  }, [activity.id]);

  const handleStatusChange = (next: ActivityStatus) => {
    setStatus(next);
    onChange({ status: next });
  };

  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--card)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 16px rgb(0 0 0 / .06)',
        zIndex: 20,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: activity.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
            Activity detail
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 26,
            height: 26,
            border: 'none',
            background: 'var(--muted)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Title */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Title</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={() => onChange({ title })}
            style={{
              width: '100%',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '7px 10px',
              outline: 'none',
              background: 'var(--background)',
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlurCapture={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>

        {/* Assigned */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Assigned to</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
            }}
          >
            <MemberAvatar member={member} size={22} />
            <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{member?.name}</span>
          </div>
        </div>

        {/* Date range */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Date range</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                flex: 1,
                padding: '7px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
              }}
            >
              {activity.startDate}
            </div>
            <ArrowRight size={12} color="var(--muted-foreground)" strokeWidth={2} style={{ flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                padding: '7px 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13,
                color: 'var(--foreground)',
                background: 'var(--background)',
              }}
            >
              {activity.endDate}
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Status</div>
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value as ActivityStatus)}
            style={{
              width: '100%',
              fontSize: 13,
              color: 'var(--foreground)',
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
            }}
          >
            {(Object.keys(STATUS_LABELS) as ActivityStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Color */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ACTIVITY_COLORS.map(c => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: c,
                  cursor: 'pointer',
                  border: activity.color === c ? '2px solid var(--foreground)' : '2px solid transparent',
                  transition: 'transform 0.1s',
                  padding: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 16 }}>
          <div style={FIELD_LABEL}>Notes</div>
          <textarea
            value={notes}
            rows={4}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => onChange({ notes })}
            placeholder="Add notes…"
            style={{
              width: '100%',
              fontSize: 13,
              color: 'var(--foreground)',
              padding: '8px 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--background)',
              outline: 'none',
              resize: 'vertical',
              lineHeight: 1.5,
              fontFamily: 'var(--font-sans)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlurCapture={e => (e.target.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            padding: 7,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Done
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'hsl(0 72% 95%)',
              color: 'var(--destructive)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
