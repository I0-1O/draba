-- Tags: team-scoped labels for activities.
-- Each team gets 6-8 tags reflecting its domain vocabulary.

-- ── Product Marketing tags ────────────────────────────────────────────────────

INSERT INTO tags (id, team_id, name, color, created_by, created_at) VALUES
  ('tag-pm-urgent',      't-product-marketing', 'urgent',      'red',    'u-brian-rieb', datetime('now', '-30 days')),
  ('tag-pm-design',      't-product-marketing', 'design',      'violet', 'u-brian-rieb', datetime('now', '-30 days')),
  ('tag-pm-content',     't-product-marketing', 'content',     'teal',   'u-brian-rieb', datetime('now', '-28 days')),
  ('tag-pm-research',    't-product-marketing', 'research',    'blue',   'u-brian-rieb', datetime('now', '-27 days')),
  ('tag-pm-launch',      't-product-marketing', 'launch',      'green',  'u-brian-rieb', datetime('now', '-26 days')),
  ('tag-pm-competitive', 't-product-marketing', 'competitive', 'amber',  'u-brian-rieb', datetime('now', '-25 days')),
  ('tag-pm-review',      't-product-marketing', 'review',      'indigo', 'u-brian-rieb', datetime('now', '-24 days')),
  ('tag-pm-blocked',     't-product-marketing', 'blocked',     'red',    'u-brian-rieb', datetime('now', '-20 days'));

-- ── P&B Tiger Team tags ───────────────────────────────────────────────────────

INSERT INTO tags (id, team_id, name, color, created_by, created_at) VALUES
  ('tag-pb-positioning', 't-pb-tiger-team', 'positioning', 'amber',  'u-brian-rieb', datetime('now', '-140 days')),
  ('tag-pb-strategy',    't-pb-tiger-team', 'strategy',    'indigo', 'u-brian-rieb', datetime('now', '-140 days')),
  ('tag-pb-research',    't-pb-tiger-team', 'research',    'blue',   'u-brian-rieb', datetime('now', '-138 days')),
  ('tag-pb-competitive', 't-pb-tiger-team', 'competitive', 'red',    'u-brian-rieb', datetime('now', '-137 days')),
  ('tag-pb-enablement',  't-pb-tiger-team', 'enablement',  'green',  'u-codi-k',     datetime('now', '-135 days')),
  ('tag-pb-executive',   't-pb-tiger-team', 'executive',   'violet', 'u-codi-k',     datetime('now', '-134 days'));

-- ── Marketing Cross Functional tags ──────────────────────────────────────────

INSERT INTO tags (id, team_id, name, color, created_by, created_at) VALUES
  ('tag-mcf-design',     't-marketing-cross-func', 'design',     'violet', 'u-scott-fitzgerald', datetime('now', '-60 days')),
  ('tag-mcf-seo',        't-marketing-cross-func', 'seo',        'teal',   'u-scott-fitzgerald', datetime('now', '-60 days')),
  ('tag-mcf-analytics',  't-marketing-cross-func', 'analytics',  'blue',   'u-scott-fitzgerald', datetime('now', '-58 days')),
  ('tag-mcf-brand',      't-marketing-cross-func', 'brand',      'purple', 'u-paula-h',          datetime('now', '-57 days')),
  ('tag-mcf-content',    't-marketing-cross-func', 'content',    'green',  'u-paula-h',          datetime('now', '-56 days')),
  ('tag-mcf-launch',     't-marketing-cross-func', 'launch',     'rose',   'u-scott-fitzgerald', datetime('now', '-55 days'));

-- ── Activity-tag associations ─────────────────────────────────────────────────

-- Product Marketing: Q1 Workload
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  ('a-q1-01', 'tag-pm-research'),
  ('a-q1-01', 'tag-pm-competitive'),
  ('a-q1-02', 'tag-pm-competitive'),
  ('a-q1-02', 'tag-pm-review'),
  ('a-q1-03', 'tag-pm-content'),
  ('a-q1-04', 'tag-pm-review'),
  ('a-q1-05', 'tag-pm-review'),
  ('a-q1-06', 'tag-pm-launch'),
  ('a-q1-06', 'tag-pm-review'),
  ('a-q1-08', 'tag-pm-urgent'),
  ('a-q1-09', 'tag-pm-design'),
  ('a-q1-09', 'tag-pm-content'),
  ('a-q1-11', 'tag-pm-content'),
  ('a-q1-13', 'tag-pm-content'),
  ('a-q1-14', 'tag-pm-launch'),
  ('a-q1-17', 'tag-pm-blocked'),
  ('a-q1-17', 'tag-pm-urgent'),
  ('a-q1-18', 'tag-pm-competitive'),
  ('a-q1-18', 'tag-pm-research');

-- Product Marketing: Sales Kick Off
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  ('a-sko-01', 'tag-pm-design'),
  ('a-sko-01', 'tag-pm-launch'),
  ('a-sko-02', 'tag-pm-competitive'),
  ('a-sko-04', 'tag-pm-content'),
  ('a-sko-05', 'tag-pm-content'),
  ('a-sko-07', 'tag-pm-review');

-- P&B Tiger Team: Right to Win Initiative
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  ('a-rtw-01', 'tag-pb-research'),
  ('a-rtw-01', 'tag-pb-competitive'),
  ('a-rtw-02', 'tag-pb-research'),
  ('a-rtw-03', 'tag-pb-positioning'),
  ('a-rtw-03', 'tag-pb-strategy'),
  ('a-rtw-04', 'tag-pb-executive'),
  ('a-rtw-04', 'tag-pb-strategy');

-- P&B Tiger Team: Displacement GTM
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  ('a-gtm-01', 'tag-pb-strategy'),
  ('a-gtm-01', 'tag-pb-competitive'),
  ('a-gtm-01', 'tag-pb-enablement'),
  ('a-gtm-02', 'tag-pb-competitive'),
  ('a-gtm-03', 'tag-pb-enablement'),
  ('a-gtm-04', 'tag-pb-strategy');

-- Marketing Cross Functional: Web Site Rebrand
INSERT INTO activity_tags (activity_id, tag_id) VALUES
  ('a-reb-01', 'tag-mcf-brand'),
  ('a-reb-02', 'tag-mcf-design'),
  ('a-reb-02', 'tag-mcf-brand'),
  ('a-reb-03', 'tag-mcf-design'),
  ('a-reb-04', 'tag-mcf-seo'),
  ('a-reb-05', 'tag-mcf-content'),
  ('a-reb-05', 'tag-mcf-seo'),
  ('a-reb-06', 'tag-mcf-analytics'),
  ('a-reb-07', 'tag-mcf-design'),
  ('a-reb-08', 'tag-mcf-content'),
  ('a-reb-09', 'tag-mcf-design'),
  ('a-reb-09', 'tag-mcf-content'),
  ('a-reb-12', 'tag-mcf-design'),
  ('a-reb-14', 'tag-mcf-launch'),
  ('a-reb-15', 'tag-mcf-analytics'),
  ('a-reb-15', 'tag-mcf-launch');
