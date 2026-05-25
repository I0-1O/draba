/**
 * IdentityWidget — composed trigger + popover for editing an entity's identity.
 *
 * Renders an IdentityTrigger; clicking it opens an IdentityPicker in a portal-
 * positioned popover. All changes fire onChange immediately (no save/cancel).
 * Click-outside closes the picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IdentityTrigger } from './IdentityTrigger';
import { IdentityPicker } from './IdentityPicker';
import type { Identity } from './identity-constants';

interface Props {
  identity: Identity;
  name: string;
  shape?: 'square' | 'circle';
  onChange: (next: Identity) => void;
}

export function IdentityWidget({ identity, name, shape = 'square', onChange }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({});

  const positionPicker = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pickerW = 240;
    const pickerH = 320;
    const gap = 6;

    // Prefer opening below the trigger; flip up if it would clip the viewport bottom.
    let top = rect.bottom + gap + window.scrollY;
    let left = rect.left + window.scrollX;

    if (top + pickerH > window.innerHeight + window.scrollY) {
      top = rect.top - pickerH - gap + window.scrollY;
    }
    if (left + pickerW > window.innerWidth) {
      left = window.innerWidth - pickerW - 8;
    }

    setPickerStyle({ position: 'fixed', top: top - window.scrollY, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPicker();
    window.addEventListener('resize', positionPicker);
    return () => window.removeEventListener('resize', positionPicker);
  }, [open, positionPicker]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        pickerRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-flex' }}>
        <IdentityTrigger
          identity={identity}
          name={name}
          shape={shape}
          open={open}
          onClick={() => setOpen(o => !o)}
        />
      </div>

      {open && createPortal(
        <div
          ref={pickerRef}
          style={{
            ...pickerStyle,
            zIndex: 9999,
            boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.15))',
            borderRadius: 10,
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <IdentityPicker
            identity={identity}
            name={name}
            shape={shape}
            onChange={onChange}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
