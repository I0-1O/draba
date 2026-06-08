-- Shares: 8 share links across 4 timelines (4 open, 4 password-protected),
-- exercising the Phase 13.2 share module — named links, descriptions, view
-- counts, varied view configs, and the password/protected indicator. Phase
-- 13.3 added List and Kanban as read-only viewers (Gantt shipped in 13.1);
-- one of each is included below alongside the Gantt links so the public
-- projection's view-type branches and the List "notes" column-gating nuance
-- (view_config.columns) are exercisable against the seeded dataset.
--
-- created_by references team_members(id) (NOT users). password_hash is a bcrypt
-- hash of "password" (the sample-data convention; all logins use "password").

INSERT INTO shares (id, timeline_id, token, name, description, view_type, view_config, password_hash, created_by, created_at, last_viewed_at, view_count) VALUES
  -- Product Marketing · Q1 Workload — an open all-hands link and a protected stakeholder view.
  ('sh-pm-q1-allhands', 'tl-pm-q1', 'share-demo-allhands',
   'All-hands public link', 'Embedded in the company all-hands deck. Read-only, grouped by assignee.',
   'gantt', '{"groupBy":"assignee","sortBy":"startDate","colorBy":"member","granularity":"week","filter":{"logic":"and","conditions":[]}}',
   NULL, 'tm-pm-erik', datetime('now', '-12 days'), datetime('now', '-1 days'), 126),

  ('sh-pm-q1-acme', 'tl-pm-q1', 'share-demo-acme',
   'Acme stakeholder view', 'Read-only status for the weekly Acme client review. Updated automatically.',
   'gantt', '{"groupBy":"none","sortBy":"startDate","colorBy":"activity","granularity":"week","filter":{"logic":"and","conditions":[]}}',
   '$2a$12$EKcdOqSJcFP0zf4MSSUf9Ou7/cglkraTAqiExfZPPWV13sIB7tIUS', 'tm-pm-lindsay', datetime('now', '-20 days'), datetime('now', '-2 days'), 48),

  -- Product Marketing · Sales Kick Off — open link for sales leadership.
  ('sh-pm-sko-leadership', 'tl-pm-sko', 'share-demo-sko',
   'Sales leadership', 'Snapshot for the SKO steering committee.',
   'gantt', '{"groupBy":"none","sortBy":"startDate","colorBy":"status","granularity":"week","filter":{"logic":"and","conditions":[]}}',
   NULL, 'tm-pm-erik', datetime('now', '-6 days'), datetime('now', '-1 days'), 31),

  -- P&B Tiger Team · Right to Win — protected exec readout.
  ('sh-pb-rtw-exec', 'tl-pb-rtw', 'share-demo-exec',
   'Exec readout', 'Scoped exec view for the Right to Win steering review.',
   'gantt', '{"groupBy":"none","sortBy":"startDate","colorBy":"activity","granularity":"month","filter":{"logic":"and","conditions":[]}}',
   '$2a$12$EKcdOqSJcFP0zf4MSSUf9Ou7/cglkraTAqiExfZPPWV13sIB7tIUS', 'tm-pb-brian', datetime('now', '-30 days'), datetime('now', '-5 days'), 9),

  -- Marketing Cross Functional · Web Site Rebrand — open contractor link + protected agency review.
  ('sh-mcf-contractor', 'tl-mcf-rebrand', 'share-demo-contractor',
   'Design contractor view', 'Scoped view for the two external design contractors.',
   'gantt', '{"groupBy":"none","sortBy":"startDate","colorBy":"activity","granularity":"week","filter":{"logic":"and","conditions":[]}}',
   NULL, 'tm-mcf-scott', datetime('now', '-18 days'), datetime('now', '-1 days'), 64),

  ('sh-mcf-agency', 'tl-mcf-rebrand', 'share-demo-agency',
   'Agency review', 'Weekly read-only link for the rebrand agency. Password protected.',
   'gantt', '{"groupBy":"assignee","sortBy":"endDate","colorBy":"member","granularity":"month","filter":{"logic":"and","conditions":[]}}',
   '$2a$12$EKcdOqSJcFP0zf4MSSUf9Ou7/cglkraTAqiExfZPPWV13sIB7tIUS', 'tm-mcf-paula', datetime('now', '-9 days'), datetime('now', '-3 days'), 17),

  -- Product Marketing · Sales Kick Off — open List link for the extended planning group.
  -- columns captures the column-visibility snapshot at share time, incl. Notes
  -- visible (drives the Phase 13.3 "notes" projection nuance) and Tags hidden
  -- (exercises "exposes exactly its enabled columns; no over-exposure").
  ('sh-pm-sko-list', 'tl-pm-sko', 'share-demo-sko-list',
   'Planning group list', 'Read-only task list for the extended SKO planning group, with notes visible.',
   'list', '{"groupBy":"none","sortBy":"startDate","colorBy":"status","granularity":"week","filter":{"logic":"and","conditions":[]},"columns":[{"id":"colorBar","visible":true},{"id":"identity","visible":true},{"id":"title","visible":true},{"id":"startAt","visible":true},{"id":"endAt","visible":true},{"id":"status","visible":true},{"id":"assignees","visible":true},{"id":"tags","visible":false},{"id":"notes","visible":true}]}',
   NULL, 'tm-pm-erik', datetime('now', '-4 days'), datetime('now', '-1 days'), 22),

  -- P&B Tiger Team · Right to Win — protected Kanban board for the extended steering group.
  ('sh-pb-rtw-kanban', 'tl-pb-rtw', 'share-demo-rtw-kanban',
   'Steering board', 'Read-only Kanban board for the Right to Win steering group, grouped by status.',
   'kanban', '{"groupBy":"status","sortBy":"startDate","colorBy":"member","granularity":"week","filter":{"logic":"and","conditions":[]}}',
   '$2a$12$EKcdOqSJcFP0zf4MSSUf9Ou7/cglkraTAqiExfZPPWV13sIB7tIUS', 'tm-pb-brian', datetime('now', '-7 days'), datetime('now', '-2 days'), 13);
