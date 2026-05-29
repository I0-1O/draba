-- Live statuses: one set per timeline, copied from the team's status template.

-- Q1 Workload (Workload statuses)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-q1-planning',   'tl-pm-q1', 'Planning',    '#64748B', 0, 0, datetime('now', '-30 days'), datetime('now', '-30 days')),
  ('s-q1-inprogress', 'tl-pm-q1', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-30 days'), datetime('now', '-30 days')),
  ('s-q1-blockers',   'tl-pm-q1', 'Blockers',    '#EF4444', 0, 2, datetime('now', '-30 days'), datetime('now', '-30 days')),
  ('s-q1-done',       'tl-pm-q1', 'Done',        '#22C55E', 1, 3, datetime('now', '-30 days'), datetime('now', '-30 days')),
  ('s-q1-deferred',   'tl-pm-q1', 'Deferred',    '#F59E0B', 1, 4, datetime('now', '-30 days'), datetime('now', '-30 days')),
  ('s-q1-cancelled',  'tl-pm-q1', 'Cancelled',   '#78716C', 1, 5, datetime('now', '-30 days'), datetime('now', '-30 days'));

-- Sales Kick Off (Default statuses)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-sko-planning',   'tl-pm-sko', 'Planning',    '#64748B', 0, 0, datetime('now', '-14 days'), datetime('now', '-14 days')),
  ('s-sko-inprogress', 'tl-pm-sko', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-14 days'), datetime('now', '-14 days')),
  ('s-sko-done',       'tl-pm-sko', 'Done',        '#22C55E', 1, 2, datetime('now', '-14 days'), datetime('now', '-14 days'));

-- Q2 Workload (Workload statuses, archived timeline)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-q2-planning',   'tl-pm-q2', 'Planning',    '#64748B', 0, 0, datetime('now', '-180 days'), datetime('now', '-180 days')),
  ('s-q2-inprogress', 'tl-pm-q2', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-180 days'), datetime('now', '-180 days')),
  ('s-q2-blockers',   'tl-pm-q2', 'Blockers',    '#EF4444', 0, 2, datetime('now', '-180 days'), datetime('now', '-180 days')),
  ('s-q2-done',       'tl-pm-q2', 'Done',        '#22C55E', 1, 3, datetime('now', '-180 days'), datetime('now', '-180 days')),
  ('s-q2-deferred',   'tl-pm-q2', 'Deferred',    '#F59E0B', 1, 4, datetime('now', '-180 days'), datetime('now', '-180 days')),
  ('s-q2-cancelled',  'tl-pm-q2', 'Cancelled',   '#78716C', 1, 5, datetime('now', '-180 days'), datetime('now', '-180 days'));

-- Right to Win Initiative (Default statuses)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-rtw-planning',   'tl-pb-rtw', 'Planning',    '#64748B', 0, 0, datetime('now', '-120 days'), datetime('now', '-120 days')),
  ('s-rtw-inprogress', 'tl-pb-rtw', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-120 days'), datetime('now', '-120 days')),
  ('s-rtw-done',       'tl-pb-rtw', 'Done',        '#22C55E', 1, 2, datetime('now', '-120 days'), datetime('now', '-120 days'));

-- Displacement GTM (Default statuses)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-gtm-planning',   'tl-pb-gtm', 'Planning',    '#64748B', 0, 0, datetime('now', '-150 days'), datetime('now', '-150 days')),
  ('s-gtm-inprogress', 'tl-pb-gtm', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-150 days'), datetime('now', '-150 days')),
  ('s-gtm-done',       'tl-pb-gtm', 'Done',        '#22C55E', 1, 2, datetime('now', '-150 days'), datetime('now', '-150 days'));

-- Web Site Rebrand (Workload statuses)
INSERT INTO statuses (id, timeline_id, name, color, is_closed, position, created_at, updated_at) VALUES
  ('s-reb-planning',   'tl-mcf-rebrand', 'Planning',    '#64748B', 0, 0, datetime('now', '-60 days'), datetime('now', '-60 days')),
  ('s-reb-inprogress', 'tl-mcf-rebrand', 'In Progress', '#3B82F6', 0, 1, datetime('now', '-60 days'), datetime('now', '-60 days')),
  ('s-reb-blockers',   'tl-mcf-rebrand', 'Blockers',    '#EF4444', 0, 2, datetime('now', '-60 days'), datetime('now', '-60 days')),
  ('s-reb-done',       'tl-mcf-rebrand', 'Done',        '#22C55E', 1, 3, datetime('now', '-60 days'), datetime('now', '-60 days')),
  ('s-reb-deferred',   'tl-mcf-rebrand', 'Deferred',    '#F59E0B', 1, 4, datetime('now', '-60 days'), datetime('now', '-60 days')),
  ('s-reb-cancelled',  'tl-mcf-rebrand', 'Cancelled',   '#78716C', 1, 5, datetime('now', '-60 days'), datetime('now', '-60 days'));
