-- Tags: team-scoped labels for activities.

-- Product Marketing team tags
INSERT INTO tags (id, team_id, name, color, created_by, created_at) VALUES
  ('tag-urgent',      't-product-marketing', 'urgent',      'red',    'u-brian-rieb', datetime('now', '-30 days')),
  ('tag-design',      't-product-marketing', 'design',      'violet', 'u-brian-rieb', datetime('now', '-30 days')),
  ('tag-content',     't-product-marketing', 'content',     'teal',   'u-brian-rieb', datetime('now', '-28 days')),
  ('tag-research',    't-product-marketing', 'research',    'blue',   'u-brian-rieb', datetime('now', '-27 days')),
  ('tag-launch',      't-product-marketing', 'launch',      'green',  'u-brian-rieb', datetime('now', '-26 days')),
  ('tag-competitive', 't-product-marketing', 'competitive', 'amber',  'u-brian-rieb', datetime('now', '-25 days')),
  ('tag-review',      't-product-marketing', 'review',      'indigo', 'u-brian-rieb', datetime('now', '-24 days')),
  ('tag-blocked',     't-product-marketing', 'blocked',     'red',    'u-brian-rieb', datetime('now', '-20 days'));

-- Activity-tag associations: tag a representative subset of activities
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  -- Q1 Workload activities
  ('a-q1-01', 'tag-research'),
  ('a-q1-01', 'tag-competitive'),
  ('a-q1-02', 'tag-competitive'),
  ('a-q1-03', 'tag-content'),
  ('a-q1-06', 'tag-launch'),
  ('a-q1-06', 'tag-review'),
  ('a-q1-08', 'tag-urgent'),
  ('a-q1-09', 'tag-design'),
  ('a-q1-09', 'tag-content'),
  ('a-q1-11', 'tag-content'),
  ('a-q1-17', 'tag-blocked'),
  -- SKO activities
  ('a-sko-01', 'tag-design'),
  ('a-sko-01', 'tag-launch');
