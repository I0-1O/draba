# UX Patterns

## Core Mental Model
The product answers one question: **"Who is working on what, and when?"**

Everything in the UI should reinforce the **Person + Time Range + Work** model. If a UI element doesn't serve that model, it probably doesn't belong in v1.

---

## Primary View: Gantt Chart

The Gantt chart is the heart of the product. Layout:

```
          Apr 28   May 1    May 5    May 10   May 15
──────────────────────────────────────────────────────
● Campaign X              [════════════] [LK]
● Project Y                       [══════] [JD]
● Task A      [══]                         [BR]
● Task B                        [════════] [BR]
──────────────────────────────────────────────────────
```

- **Rows** = events, one bar per event
- **Left column** — event color dot, title, member avatar(s) (all assignees, stacked)
- **Bar** — spans the event's start/end dates
- **Color** is tied to the event (user-set)
- Clicking a bar or the row label opens the event detail panel (slide-in right panel)
- Clicking an empty area of the time grid starts block creation

### Timeline Sub-Toolbar
A thin toolbar between the top bar and the grid provides:

| Control | Options | Notes |
|---------|---------|-------|
| **Zoom** | ± buttons | Steps through column widths: 40 → 60 → 80 → 120 → 160 px/day |
| **Group by** | None, Member, Parent event | See grouping rules below |
| **Sort by** | Start date, End date, Title A–Z | Applied within each group |
| **Export** | CSV / Excel | Exports the visible date range (Phase 13) |

### Grouping Rules

**Group by None (default)**
Flat list of all events, sorted by the active sort key.

**Group by Member**
One section header per assigned member, in team-member order. Events appear under their primary assignee (first in `assignedMemberIds`). Unassigned events appear in an "Unassigned" section at the bottom.

**Group by Parent Event**
Root events (no `parentEventId`) appear as top-level rows. Child events are indented beneath their parent. Children whose parent falls outside the current date range appear at the bottom with extra indentation as orphans.

### Timeline Navigation
- Scroll horizontally to move through time
- Zoom in/out via sub-toolbar buttons (day column width)
- "Today" marker — vertical line + highlighted column

### Block Interactions
- **Click** a bar or row label — opens event detail panel
- **Drag** a bar left/right — shifts start and end dates
- **Drag bar edges** — resize (change start or end date independently)
- **Drag on empty grid area** — opens "new event" form pre-filled with the clicked date
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
