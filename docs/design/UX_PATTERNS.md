# UX Patterns

## Core Mental Model
The product answers one question: **"Who is working on what, and when?"**

Everything in the UI should reinforce the **Person + Time Range + Work** model. If a UI element doesn't serve that model, it probably doesn't belong in v1.

---

## Primary View: Horizontal Timeline

The timeline is the heart of the product. Layout:

```
          Apr 28   May 1    May 5    May 10   May 15
──────────────────────────────────────────────────────
Lindsay   [Campaign X ════════════]
    Jen                   [Project Y ══════]
   Brian  [Task A ══]            [Task B ════════]
──────────────────────────────────────────────────────
```

- **Rows** = people assigned to the team
- **Blocks** = events, spanning their start/end dates
- **Color** is tied to the event (user-set), not the person — allows a person to have visually distinct work items
- **Icon** optionally appears inside the block for quick visual scanning
- Clicking a block opens the event detail panel (not a modal — slide-in or side panel)
- Clicking an empty area of a person's lane starts block creation

### Timeline Navigation
- Scroll horizontally to move through time
- Zoom controls: Day / Week / Month granularity
- "Today" button recenters the view
- Date range picker to jump to a specific period

### Block Interactions
- **Click-and-drag** on empty lane space to create a new block (sets person + date range)
- **Drag** an existing block left/right to shift dates
- **Drag edges** of a block to resize (change start or end date)
- All drag interactions optimistically update the UI and sync in real-time to other viewers

---

## Navigation
- Primary nav: left sidebar (collapsible on smaller screens)
  - Team selector (if user is on multiple teams)
  - Timeline list for the active team
  - Settings (team admin only)
- No top nav bar — maximize horizontal timeline space
- Mobile: sidebar becomes a bottom sheet or hamburger menu (TBD — PWA is post-v1)

---

## Event Detail Panel
Opens when a block is clicked. Slide-in from the right, does not cover the timeline.

Fields shown:
- Title (editable inline)
- Assigned people (add/remove)
- Date range (date pickers)
- Status (dropdown: planned / in progress / done)
- Percent complete (slider or number input)
- Tags (multi-select)
- Icon (emoji picker or icon set — TBD)
- Color (color swatch picker)
- Notes/Description (rich text or markdown — TBD)
- Parent event (optional — searchable dropdown of other team events)

Close by clicking outside the panel or pressing Escape.

---

## Loading States
- Timeline blocks: render the grid and empty lanes immediately; populate blocks as data loads (skeleton shimmer on block placeholders)
- Event detail panel: optimistic — show the panel with stale data immediately, confirm with server response
- Real-time updates: blocks animate in/out smoothly when changes arrive via WebSocket; no jarring full-page refreshes

---

## Error States
- **Form validation:** inline, shown on blur or submit — not on every keystroke
- **Network errors:** toast notification (bottom right), auto-dismiss after 5s, with a "retry" option for mutations
- **WebSocket disconnect:** subtle connection status indicator in the corner; automatically reconnects, notifies user if offline for > 10s
- **Empty state (no events in range):** light message in the lane area ("Nothing scheduled — drag to add a block")

---

## Sharing Flow
- "Share" button in the timeline header
- Shows the shareable link with a one-click copy button
- Toggle: Public (anyone with link) vs Restricted (specific people)
- For restricted: add/remove users from the access list inline in the share dialog
- Public link viewers see the timeline read-only with no login prompt
- Share dialog also shows the iCal feed URL for calendar app subscription

---

## Real-Time Collaboration
- No presence avatars in v1 (keep it simple)
- Changes from other users animate smoothly into the timeline
- If two users edit the same block simultaneously, last write wins (server timestamp); no conflict UI in v1
- Connection status indicator (small dot — green connected, yellow reconnecting, red offline)

---

## Responsive Behavior
- Primary target: desktop browser (1200px+)
- Timeline degrades gracefully to ~768px (tablet landscape)
- Below 768px: show a simplified list view as fallback (the drag-and-drop timeline is not usable on small touch screens)
- PWA / mobile native: parking lot for post-v1

---

## Accessibility
- All interactive elements keyboard-navigable (Tab, Enter, Arrow keys for timeline navigation)
- Block creation via keyboard (focus a lane, press Enter to open "new event" form)
- WCAG AA color contrast minimum
- Screen reader labels for timeline lanes and event blocks
- Focus management: when event detail panel opens, focus moves to the first editable field

---

## Platform-Specific Notes
- Web only for v1
- Public share links must work without JavaScript for basic read-only rendering (SEO + email preview compatibility) — TBD on feasibility with React
