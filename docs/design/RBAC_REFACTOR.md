# Role-Based Access Control (RBAC) & Participants Refactor Plan

## Overview
This document outlines the planned changes to Draba's authorization model to support more granular roles (Superadmin, Team Admin, Timeline Admin) and to allow scheduling "Participants" (e.g., external contractors or placeholders) who do not have a registered Draba account.

## 1. Participation Levels
Draba will support four distinct levels of participation:

*   **Team Admins:** Manage the team overall. Can invite new people to the team and can create multiple teams.
*   **Timeline Admins:** Scoped to specific timelines. Can configure those timelines and add/remove people (from the team) to their timelines.
*   **Users:** Have a standard login. Can participate in timelines assigned to them.
*   **Participants:** Do not have a login. They are managed as team members so they can be scheduled on timelines and assigned colors without needing account access.

*(Note: There is also a system-level **Superadmin** designation, typically granted to the first user, who has global permissions like creating new teams).*

## 2. Database Schema Changes

To support these new levels, the database schema requires several structural updates:

### `users` Table
*   Add `is_superadmin BOOLEAN NOT NULL DEFAULT 0`.
*   *Migration:* The very first user created in the system should automatically be granted `is_superadmin = true`.

### `team_members` Table
This table needs a major overhaul to support login-less participants.
*   Add `id TEXT PRIMARY KEY`.
*   Change `user_id` to be `NULLABLE`. (If `NULL`, this represents a Participant).
*   Add `display_name TEXT`. (Populated for Participants since they don't have a `users` record to draw from. Coalesced with `users.display_name` in queries).
*   *Roles:* The `role` column will continue to represent Team-level roles (`admin` or `member`).

### `event_assignments` Table
*   Change foreign key from `user_id` to `team_member_id` (FK → `team_members.id`).
*   This ensures events can be assigned to Participants who lack a `user_id`.

### `timeline_access` Table
*   Change foreign key from `user_id` to `team_member_id`.
*   Add `role` column (e.g., `admin` | `member`) to designate Timeline Admins vs. regular timeline viewers.

### `timelines` Table
*   Remove the `visibility` column (e.g., `public` vs `restricted`). Visibility and access will now be governed entirely by the `timeline_access` table and the user's role.

## 3. API & Backend Implementation Steps

1.  **Migrations:** Write and apply SQL migrations for the schema changes above.
2.  **Models Update:** Update Go structs in `packages/api/internal/models/models.go` to match the new schema (`TeamMember` needs `ID`, nullable `UserID`, etc.).
3.  **Repository Updates:**
    *   Update `TeamRepo` to handle the new `team_members` schema, generate IDs on insert, and handle the `COALESCE` for display names.
    *   Update `TimelineRepo` to drop visibility checks and enforce the new `timeline_access` rules based on `team_member_id`.
    *   Update `EventRepo` to join on `team_member_id` instead of `user_id`.
4.  **Handler Updates:**
    *   `auth_handler.go`: Grant `is_superadmin` to the first registered user. Ensure registering via an invite links to the correct `team_member_id`.
    *   `team_handler.go`: Ensure team creation handles the new `TeamMember` structure. Restrict team creation to `is_superadmin` (if that is the desired behavior).
    *   `timeline_handler.go`: Update timeline creation and fetching to use the new access control model.
5.  **Test Fixes:** Update all unit tests and mock repositories to reflect the schema and logic changes.

## 4. UI Implementation Steps

1.  **Team Management:** Update the team members UI to allow adding "Participants" without an email address.
2.  **Timeline Assignment:** Update UI dropdowns for event assignment to use `team_member_id` instead of `user_id`.
3.  **Access Control:** Render admin controls (settings, delete, invite) conditionally based on whether the logged-in user is a Team Admin or a Timeline Admin for the current context.

---
*Note: The previous work session also included partial implementations for "External Connectors" (inbound webhooks for Asana, Jira). Those features are distinct from the RBAC refactor and will be tracked as a separate architectural update.*