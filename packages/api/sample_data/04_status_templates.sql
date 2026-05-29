-- Status templates and their items.
-- 5 templates total: Default + Workload for PM and MCF, Default for P&B.

-- Product Marketing: Default
INSERT INTO status_templates (id, team_id, name, position, created_by, created_at, updated_at) VALUES
  ('st-pm-default', 't-product-marketing', 'Default', 0, 'u-brian-rieb', datetime('now', '-90 days'), datetime('now', '-90 days'));
INSERT INTO status_template_items (id, template_id, name, color, is_closed, position) VALUES
  ('sti-pm-d-planning',   'st-pm-default', 'Planning',    '#64748B', 0, 0),
  ('sti-pm-d-inprogress', 'st-pm-default', 'In Progress', '#3B82F6', 0, 1),
  ('sti-pm-d-done',       'st-pm-default', 'Done',        '#22C55E', 1, 2);

-- Product Marketing: Workload
INSERT INTO status_templates (id, team_id, name, position, created_by, created_at, updated_at) VALUES
  ('st-pm-workload', 't-product-marketing', 'Workload', 1, 'u-brian-rieb', datetime('now', '-90 days'), datetime('now', '-90 days'));
INSERT INTO status_template_items (id, template_id, name, color, is_closed, position) VALUES
  ('sti-pm-w-planning',   'st-pm-workload', 'Planning',    '#64748B', 0, 0),
  ('sti-pm-w-inprogress', 'st-pm-workload', 'In Progress', '#3B82F6', 0, 1),
  ('sti-pm-w-blockers',   'st-pm-workload', 'Blockers',    '#EF4444', 0, 2),
  ('sti-pm-w-done',       'st-pm-workload', 'Done',        '#22C55E', 1, 3),
  ('sti-pm-w-deferred',   'st-pm-workload', 'Deferred',    '#F59E0B', 1, 4),
  ('sti-pm-w-cancelled',  'st-pm-workload', 'Cancelled',   '#78716C', 1, 5);

-- P&B Tiger Team: Default
INSERT INTO status_templates (id, team_id, name, position, created_by, created_at, updated_at) VALUES
  ('st-pb-default', 't-pb-tiger-team', 'Default', 0, 'u-brian-rieb', datetime('now', '-88 days'), datetime('now', '-88 days'));
INSERT INTO status_template_items (id, template_id, name, color, is_closed, position) VALUES
  ('sti-pb-d-planning',   'st-pb-default', 'Planning',    '#64748B', 0, 0),
  ('sti-pb-d-inprogress', 'st-pb-default', 'In Progress', '#3B82F6', 0, 1),
  ('sti-pb-d-done',       'st-pb-default', 'Done',        '#22C55E', 1, 2);

-- Marketing Cross Functional: Default
INSERT INTO status_templates (id, team_id, name, position, created_by, created_at, updated_at) VALUES
  ('st-mcf-default', 't-marketing-cross-func', 'Default', 0, 'u-scott-fitzgerald', datetime('now', '-75 days'), datetime('now', '-75 days'));
INSERT INTO status_template_items (id, template_id, name, color, is_closed, position) VALUES
  ('sti-mcf-d-planning',   'st-mcf-default', 'Planning',    '#64748B', 0, 0),
  ('sti-mcf-d-inprogress', 'st-mcf-default', 'In Progress', '#3B82F6', 0, 1),
  ('sti-mcf-d-done',       'st-mcf-default', 'Done',        '#22C55E', 1, 2);

-- Marketing Cross Functional: Workload
INSERT INTO status_templates (id, team_id, name, position, created_by, created_at, updated_at) VALUES
  ('st-mcf-workload', 't-marketing-cross-func', 'Workload', 1, 'u-scott-fitzgerald', datetime('now', '-75 days'), datetime('now', '-75 days'));
INSERT INTO status_template_items (id, template_id, name, color, is_closed, position) VALUES
  ('sti-mcf-w-planning',   'st-mcf-workload', 'Planning',    '#64748B', 0, 0),
  ('sti-mcf-w-inprogress', 'st-mcf-workload', 'In Progress', '#3B82F6', 0, 1),
  ('sti-mcf-w-blockers',   'st-mcf-workload', 'Blockers',    '#EF4444', 0, 2),
  ('sti-mcf-w-done',       'st-mcf-workload', 'Done',        '#22C55E', 1, 3),
  ('sti-mcf-w-deferred',   'st-mcf-workload', 'Deferred',    '#F59E0B', 1, 4),
  ('sti-mcf-w-cancelled',  'st-mcf-workload', 'Cancelled',   '#78716C', 1, 5);
