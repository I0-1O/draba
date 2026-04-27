# Requirements

## Product Summary
draba is a lightweight team coordination and planning tool. It answers one question — **"Who is working on what, and when?"** — without the overhead of a full project management suite. The primary interface is a horizontal timeline grouped by person, where work appears as blocks across time. Teams adopt it in minutes, not weeks.

**Target users:** Small teams of 5–20 people. Marketing, creative, and product teams who need visibility across people and time without tickets, sprints, or dependencies.

**Positioning:** Not a calendar replacement. Not a project management tool. A shared team timeline.

---

## Functional Requirements

### Users and Auth
- [ ] Admins can invite users to a team via email invite link
- [ ] Invited users register by following the invite link and setting up an account (email + password)
- [ ] Users have: display name, email, optional avatar
- [ ] Two roles: **admin** (manages team, invites members) and **member** (views and edits events)
- [ ] Users can belong to multiple teams simultaneously
- [ ] Password reset via email

### API Access Tokens
Programmatic access (CLI, webhooks, MCP) uses scoped API tokens rather than user passwords.

- [ ] Admins and members can generate named API tokens for their account
- [ ] Tokens have a configurable permission scope: read-only | add | edit/delete own | edit/delete all
- [ ] Tokens can be revoked at any time
- [ ] Token values are shown once at creation and never stored in plaintext (hashed at rest)
- [ ] CLI, webhook consumers, and MCP integrations authenticate using these tokens

### Teams
- [ ] Admins can create teams
- [ ] Admins can invite users to a team by email
- [ ] Admins can remove members from a team
- [ ] Admins can promote a member to admin
- [ ] Teams have a name and a list of members

### Events
Events are the core data object — a block of time assigned to one or more people.

- [ ] Events have: title, start date/time, end date/time, description/notes, status, percent complete, tags, icon, color, assigned people (one or more)
- [ ] Events can have a parent event (another event within the same team), enabling simple nesting (e.g., "Launch Week" contains "Design Review")
- [ ] Events store all standard CalDAV VEVENT fields natively (UID, DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION, URL, RRULE, etc.) so no information is lost in sync
- [ ] Events support recurrence rules (RRULE) from CalDAV/Google
- [ ] Events are scoped to a team
- [ ] Events can be archived (hidden from active views but not deleted; recoverable)

### Timelines
Timelines are named viewing windows — a name and a date range — scoped to a team. They are not data containers; they are views over the team's events.

- [ ] Teams can create multiple timelines, including overlapping ones
- [ ] Each timeline has: name, start date, end date, visibility setting
- [ ] Visibility options: **public** (default — anyone with the link can view, no login required) or **restricted** (specific authenticated users)
- [ ] Share links can be generated for any timeline
- [ ] Public timeline viewers see the timeline read-only without an account
- [ ] Timelines can be archived (removed from active list but preserved; recoverable)

### Timeline Views
The primary view is the horizontal timeline. Additional views display the same underlying events in different formats.

- [ ] **Timeline view** (primary) — horizontal, grouped by person; see `docs/design/UX_PATTERNS.md`
- [ ] **Calendar view** — weekly, daily, and monthly grid layouts (standard calendar format)
- [ ] **List view** — simple chronological or grouped list of events
- [ ] **Kanban view** — read-only; columns = statuses (in the team's configured status order); cards = events, color-coded by assigned person(s); multiple assignees shown as stacked color indicators. This is a viewing mode only — dragging cards to change status is out of scope for v1.
- [ ] View switcher in the timeline header to toggle between available views

> **Scope note:** Gantt view overlaps significantly with the timeline view and adds dependency complexity — parking lot. Kanban is intentionally read-only in v1; drag-to-change-status is a later addition once the status model is proven.

### Team Configuration
Admins can customize team-level settings that apply to all members and views.

**Statuses**
- [ ] Each team has a configurable list of statuses (name + color)
- [ ] Default statuses created when a team is created: `Planned`, `In Progress`, `Done`
- [ ] Admins can add, rename, reorder, and delete statuses
- [ ] Statuses have a display order that controls column order in Kanban view and sort order in dropdowns
- [ ] At least one status must always exist (cannot delete the last one)
- [ ] Deleting a status requires choosing a replacement status for any events currently using it
- [ ] Status color is used as the column header color in Kanban view

**Member Colors**
- [ ] Each team member has a display color, used to color-code their events in Kanban view and any other person-first views
- [ ] Admin can set member colors; members can also set their own
- [ ] Default color is auto-assigned from a preset palette on invite acceptance

### Real-Time Collaboration
- [ ] Multiple users can view and edit the same timeline simultaneously
- [ ] Changes (event create, update, delete) appear in real-time for all connected users
- [ ] No last-write-wins data loss — changes are applied and broadcast immediately

### Calendar Sync
- [ ] Users can connect a personal Google Calendar account (OAuth 2.0) for two-way sync of their assigned events
- [ ] Users can connect a personal CalDAV account (iOS/macOS Calendar, Fastmail, Thunderbird, etc.) for two-way sync
- [ ] draba implements a built-in CalDAV endpoint — Apple Calendar users point their app directly at the draba server
- [ ] Outbound sync: when an event is created/updated/deleted in draba, changes push to all connected personal calendars for assigned users
- [ ] Inbound sync: changes made in Google Calendar trigger a webhook that updates draba
- [ ] **Team read-only feed:** each timeline exposes a subscribable iCal/CalDAV URL that any calendar app can subscribe to for a read-only view of all team events in that timeline
- [ ] Public iCal/Google Calendar feeds include only basic event info (title, date range, assigned people) — notes and internal fields are stripped
- [ ] Microsoft/Outlook sync is explicitly out of scope for v1

### Sharing and Public Access
- [ ] Public timelines are accessible via a stable share URL with no login
- [ ] Public viewers see all events on the timeline read-only
- [ ] Restricted timelines require the viewer to be an authenticated member listed in the timeline's access list
- [ ] Each timeline exposes a public iCal feed URL (usable in Google Calendar, Apple Calendar, Outlook, etc.) containing sanitized event data

### Data Portability
- [ ] Events can be exported to CSV and Excel (.xlsx) from any timeline view
- [ ] Events can be imported from a CSV or Excel file
- [ ] A downloadable template file is provided showing the expected import format
- [ ] Import shows a preview and validation errors before committing

---

## Non-Functional Requirements
- [ ] API response time < 200ms for standard reads under normal load
- [ ] Real-time updates delivered within 500ms of a change
- [ ] Self-hosted: runs as a single Docker container with no external service dependencies
- [ ] Direct binary install is also supported (for users who don't use Docker)
- [ ] Database: SQLite by default; MySQL/MariaDB and Postgres are supported configuration options
- [ ] Same Docker artifact deploys to self-hosted and any future cloud offering
- [ ] All API endpoints are authenticated (except public timeline share links and public iCal feeds)
- [ ] All secrets, calendar credentials, and API tokens stored encrypted/hashed at rest

---

## Constraints
- Must run as a single Docker container with zero required external services (SQLite path)
- No paid third-party services required for self-hosting
- Calendar sync credentials and API tokens must never be stored in plaintext
- No server-side rendering required

---

## Out of Scope (v1)
- Microsoft / Outlook / Exchange calendar sync
- Kanban drag-to-change-status (Kanban is in v1 as a read-only view; interactive status changes via drag are v2)
- Gantt view with dependencies (overlaps with timeline view; adds dependency complexity)
- Time tracking or billable hours
- Task dependencies or critical path
- Workload balancing or capacity planning
- Billing or invoicing
- Automation or rule-based triggers
- Mobile native apps (web/PWA first)
- Multi-tenant cloud hosting (self-hosted per-customer to start)
- SSO / SAML / OAuth login (email + password only for v1)
- MCP server integration (parking lot — token auth system is designed to support it when ready)
- CLI binary (parking lot — token auth system is designed to support it when ready)
