# Sample Data Procedure

Guide for generating and maintaining a sample data SQL script that can flush and reload the database with realistic test data. Run this procedure whenever the schema changes in a way that affects the sample dataset.

## When to regenerate

- A migration adds, removes, or renames a column used by sample data
- A new table is added that should be populated for a realistic experience
- Identity system colors or icons change
- Status template structure changes

## How to run

Sample data lives in `packages/api/sample_data/` as numbered per-table SQL files. Files are concatenated in sort order to form a complete flush-and-reload script.

```bash
# SQLite CLI
cat packages/api/sample_data/*.sql | sqlite3 draba.db

# Verify
go test ./internal/db/ -run TestSampleDataLoads
```

### Updating a single table

When a schema change affects one table, edit only that file (e.g. add a column to `01_users.sql`). Run the test to verify. No need to regenerate the entire dataset.

---

## Data generation rules

### Passwords

All user passwords must be `password` (minimum 8 characters per the app's validation). Store the bcrypt hash of `password` at cost 12 (the project standard). Generate the hash once and reuse it across all user rows.

Current hash: `$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG`

### Identity fields (color + icon)

Every record that has identity fields (`color` and `icon` columns) gets a randomly chosen color and icon, subject to these rules:

| Entity | color | icon | Notes |
|---|---|---|---|
| Teams | Random hex from palette | Random Lucide icon or `__name_2__` | |
| Timelines | Random hex from palette | Random Lucide icon or `__none__` | |
| Activities | Random hex from palette | Random Lucide icon or `__none__` | |
| Users | Random hex from palette | `__name_words__` | Always use `__name_words__` for users |
| Team members | Random hex from palette | `__name_words__` | Always use `__name_words__` for members |

**Color palette** (16 colors, store as hex):

| ID | Hex |
|---|---|
| teal | `#288C9B` |
| cyan | `#06B6D4` |
| blue | `#3B82F6` |
| indigo | `#6366F1` |
| violet | `#8B5CF6` |
| purple | `#A855F7` |
| pink | `#EC4899` |
| rose | `#F43F5E` |
| red | `#EF4444` |
| orange | `#F97316` |
| amber | `#F59E0B` |
| yellow | `#EAB308` |
| lime | `#84CC16` |
| green | `#22C55E` |
| slate | `#64748B` |
| stone | `#78716C` |

**Icon options for non-user/member entities** (pick from 64 Lucide IDs):
`activity`, `archive`, `award`, `bar-chart`, `bell`, `bookmark`, `briefcase`, `calendar`, `check-circle`, `clipboard`, `clock`, `cloud`, `code`, `coffee`, `compass`, `cpu`, `database`, `download`, `edit`, `eye`, `file-text`, `filter`, `flag`, `folder`, `git-branch`, `globe`, `grid`, `heart`, `help-circle`, `home`, `info`, `layers`, `link`, `list`, `lock`, `mail`, `map`, `message-circle`, `moon`, `package`, `pencil`, `phone`, `pie-chart`, `plug`, `refresh-cw`, `search`, `server`, `settings`, `share`, `shield`, `star`, `sun`, `tag`, `target`, `terminal`, `trash`, `trending-up`, `upload`, `user`, `users`, `wifi`, `zap`, `alert-circle`, `copy`

Or use the special tokens: `__none__` (color only), `__name_1__` (first letter), `__name_2__` (first two letters), `__name_words__` (initials).

### IDs

All IDs are UUIDs (TEXT). Generate deterministic UUIDs for sample data so the script is idempotent.

### Timestamps

Use relative dates anchored to "now" so the data always looks current:
- `created_at` / `joined_at`: spread across the past few months
- Timeline `start_date` / `end_date`: see per-timeline specs below
- Activity date ranges: distributed within their timeline's window

### Deletion order (flush)

See `sample_data/00_flush.sql` — deletes all data in reverse FK dependency order. Tables NOT flushed: `schema_migrations`, `instance_settings`, `saved_filters`.

---

## Dataset specification

### Super admins

Set `is_superadmin = 1` on these users:

| Name | Email |
|---|---|
| Brian Rieb | brian@rieb.cc |
| Scott Fitzgerald | scott@fitzgerald.example |

### Users

Create a user row for every person referenced below. Each user gets:
- Deterministic UUID
- Email derived from name (e.g. `brian@rieb.cc` for Brian, `lindsay.k@example.com` for Lindsay K.)
- `password_hash`: bcrypt of `pass`
- `color`: random hex from palette
- `icon`: `__name_words__`

Full user list (deduplicated across all teams):
- Brian Rieb (super admin)
- Scott Fitzgerald (super admin)
- Lindsay K.
- Erik B
- Michelle T
- Codi K
- Dan S
- Kristen K
- Jamie F
- Paula H
- Corey F
- Dan B
- Rick S

### Teams

#### 1. Product Marketing

- **Slug**: `product-marketing`
- **Identity**: random color + random icon
- **Members**:

| Person | Role | Notes |
|---|---|---|
| Brian R | `admin` | |
| Lindsay K | `member` | |
| Erik B | `admin` | |
| Michelle T | `member` | |
| Contractor | `member` | Participant: `user_id = NULL`, `display_name = 'Contractor'` |

- **Status templates**:
  - **Default**: Planning, In Progress, Done
  - **Workload**: Planning, In Progress, Blockers, Done, Deferred, Cancelled

- **Timelines**:

  **Q1 Workload**
  - 3-month window (e.g. now − 1 month → now + 2 months)
  - ~20 activities: PMM work (competitive analysis, messaging docs, launch plans, analyst briefings, content reviews, etc.)
  - Most activities assigned to one person
  - Uses **Workload** statuses
  - Distribute statuses realistically (some done, some in progress, a few planning)

  **Sales Kick Off**
  - 2-month window
  - ~10 activities: sales enablement prep (deck creation, battle cards, demo scripts, training sessions, etc.)
  - Activities assigned to multiple people
  - Uses **Default** statuses

  **Q2 Workload** *(archived)*
  - 3-month window in the past (set `archived_at`)
  - ~5 activities: high-level PMM tasks
  - Most assigned to one person
  - Uses **Workload** statuses

#### 2. P&B Tiger Team *(archived)*

- **Slug**: `pb-tiger-team`
- **Identity**: random color + random icon
- **`archived_at`**: set to a past date
- **Members**:

| Person | Role |
|---|---|
| Brian R | `admin` |
| Scott F | `member` |
| Codi K | `admin` |
| Dan S | `member` |
| Kristen K | `member` |
| Jamie F | `member` |

Note: Kristen K is described as a "participant" in the brief, but the schema only supports `admin` and `member` roles. External participants use `user_id = NULL`. Since Kristen is a named user, she is a `member`.

- **Status templates**:
  - **Default**: Planning, In Progress, Done

- **Timelines**:

  **Right to Win Initiative**
  - 2-month window
  - ~4 activities: researching and presenting the right-to-win for a product
  - Uses **Default** statuses

  **Displacement GTM**
  - 3-month window
  - ~4 activities: building a GTM for a displacement play, sales enablement
  - Uses **Default** statuses

#### 3. Marketing Cross Functional

- **Slug**: `marketing-cross-functional`
- **Identity**: random color + random icon
- **Members**:

| Person | Role |
|---|---|
| Scott F | `admin` |
| Paula H | `admin` |
| Corey F | `member` |
| Dan B | `member` |
| Rick S | `member` |

- **Status templates**:
  - **Default**: Planning, In Progress, Done
  - **Workload**: Planning, In Progress, Blockers, Done, Deferred, Cancelled

- **Timelines**:

  **Web Site Rebrand**
  - 6-month window
  - ~15 activities: rebranding and rebuilding the corporate website (design system, content migration, SEO audit, stakeholder reviews, launch prep, etc.)
  - Uses **Workload** statuses

---

## Activity content guidelines

When generating activity titles and descriptions, make them sound like real PMM / marketing work:

- **PMM activities**: Competitive battlecard update, Analyst briefing prep, Q1 messaging framework, Product launch checklist, Win/loss interview synthesis, Pricing positioning doc, Sales one-pager refresh
- **Sales enablement**: SKO keynote deck, Demo environment setup, Objection handling workshop, New rep onboarding kit, Customer story video
- **Website/brand**: Brand guidelines v2, Homepage hero redesign, SEO keyword audit, Content migration plan, Analytics tagging spec, Stakeholder review meeting, Accessibility audit, Launch readiness checklist

Activities should have realistic date ranges (a few days to a few weeks each), spread across their timeline window without excessive overlap.

---

## Schema reference (current as of migration 015)

This section summarizes the tables and columns that sample data touches. Regenerate this section if migrations change the schema.

### Core tables

```
users (id, email, password_hash, display_name, avatar_url, color, icon, is_superadmin, created_at, updated_at, archived_at)
teams (id, name, slug, color, icon, description, notes, archived_at, invite_link_token, created_at, updated_at)
team_members (id, team_id, user_id, display_name, role, color, icon, joined_at, archived_at)
timelines (id, team_id, name, start_date, end_date, description, notes, color, icon, share_token, ical_token, created_by, created_at, updated_at, archived_at)
activities (id, timeline_id, title, description, icon, color, start_at, end_at, all_day, status_id, parent_activity_id, percent_complete, location, url, created_by, created_at, updated_at, archived_at)
```

### Junction / child tables

```
activity_assignments (activity_id, team_member_id)
activity_tags (activity_id, tag)
timeline_access (timeline_id, team_member_id, role)
status_templates (id, team_id, name, description, position, created_by, created_at, updated_at)
status_template_items (id, template_id, name, color, icon, is_closed, position)
statuses (id, timeline_id, name, color, icon, is_closed, position, created_at, updated_at)
```

### Tables NOT in sample data scope

```
schema_migrations — managed by the migration runner
instance_settings — configured per deployment
saved_filters — user-generated at runtime
calendar_connections — requires real OAuth credentials
api_tokens — generated at runtime
invites — generated at runtime
password_reset_tokens — generated at runtime
user_preferences — set by users at runtime
```
