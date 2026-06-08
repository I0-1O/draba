# Sample Data

SQL files that populate the database with realistic test data. Files are numbered to respect FK insertion order.

| File | Contents |
|---|---|
| `00_flush.sql` | Deletes all data in FK-safe order |
| `01_users.sql` | 13 users (2 super admins) |
| `02_teams.sql` | 3 teams (1 archived) |
| `03_team_members.sql` | 16 members (1 external participant) |
| `04_status_templates.sql` | 5 templates + 21 items |
| `05_timelines.sql` | 6 timelines (1 archived) |
| `06_statuses.sql` | Live statuses per timeline |
| `07_activities.sql` | 58 activities |
| `08_activity_assignments.sql` | Activity → member links |
| `09_timeline_access.sql` | Timeline → member access |
| `10_tags.sql` | Tags + activity → tag links |
| `11_shares.sql` | 8 share links (4 open, 4 password-protected; gantt/list/kanban view types) |

## Usage

All files concatenated in order form a complete flush-and-reload script.

**SQLite CLI:**
```bash
cat sample_data/*.sql | sqlite3 draba.db
```

**Go test:** See `internal/db/sample_data_test.go`.

## Updating

When a schema migration changes a table that has sample data:
1. Edit only the affected file (e.g., add a column to `01_users.sql`)
2. Run `go test ./internal/db/ -run TestSampleDataLoads` to verify

See `docs/SAMPLE_DATA.md` for the full dataset specification and identity rules.

## Credentials

All user passwords: `password`
