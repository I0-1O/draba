-- Teams: 3 total (1 archived).

INSERT INTO teams (id, name, slug, color, icon, created_at, updated_at) VALUES
  ('t-product-marketing',    'Product Marketing',          'product-marketing',          '#F97316', 'briefcase', datetime('now', '-90 days'), datetime('now', '-1 days')),
  ('t-pb-tiger-team',        'P&B Tiger Team',             'pb-tiger-team',              '#EF4444', 'target',    datetime('now', '-88 days'), datetime('now', '-30 days')),
  ('t-marketing-cross-func', 'Marketing Cross Functional', 'marketing-cross-functional', '#8B5CF6', 'globe',     datetime('now', '-75 days'), datetime('now', '-2 days'));

UPDATE teams SET archived_at = datetime('now', '-30 days') WHERE id = 't-pb-tiger-team';
