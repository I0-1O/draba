-- Timelines: 6 total (1 archived).

-- Product Marketing: Q1 Workload (3 months: now-1mo to now+2mo)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at) VALUES
  ('tl-pm-q1', 't-product-marketing', 'Q1 Workload',
   date('now', '-30 days'), date('now', '+60 days'),
   '#F97316', 'bar-chart',
   'share-pm-q1-token', 'ical-pm-q1-token',
   'u-brian-rieb', datetime('now', '-30 days'), datetime('now', '-1 days'));

-- Product Marketing: Sales Kick Off (2 months: now to now+2mo)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at) VALUES
  ('tl-pm-sko', 't-product-marketing', 'Sales Kick Off',
   date('now'), date('now', '+60 days'),
   '#06B6D4', 'award',
   'share-pm-sko-token', 'ical-pm-sko-token',
   'u-erik-b', datetime('now', '-14 days'), datetime('now', '-2 days'));

-- Product Marketing: Q2 Workload (archived, 3 months in the past)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at, archived_at) VALUES
  ('tl-pm-q2', 't-product-marketing', 'Q2 Workload',
   date('now', '-180 days'), date('now', '-90 days'),
   '#F59E0B', 'clipboard',
   'share-pm-q2-token', 'ical-pm-q2-token',
   'u-brian-rieb', datetime('now', '-180 days'), datetime('now', '-90 days'), datetime('now', '-85 days'));

-- P&B Tiger Team: Right to Win Initiative (2 months)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at) VALUES
  ('tl-pb-rtw', 't-pb-tiger-team', 'Right to Win Initiative',
   date('now', '-120 days'), date('now', '-60 days'),
   '#EF4444', 'search',
   'share-pb-rtw-token', 'ical-pb-rtw-token',
   'u-brian-rieb', datetime('now', '-120 days'), datetime('now', '-60 days'));

-- P&B Tiger Team: Displacement GTM (3 months)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at) VALUES
  ('tl-pb-gtm', 't-pb-tiger-team', 'Displacement GTM',
   date('now', '-150 days'), date('now', '-60 days'),
   '#F43F5E', 'trending-up',
   'share-pb-gtm-token', 'ical-pb-gtm-token',
   'u-codi-k', datetime('now', '-150 days'), datetime('now', '-60 days'));

-- Marketing Cross Functional: Web Site Rebrand (6 months: now-2mo to now+4mo)
INSERT INTO timelines (id, team_id, name, start_date, end_date, color, icon, share_token, ical_token, created_by, created_at, updated_at) VALUES
  ('tl-mcf-rebrand', 't-marketing-cross-func', 'Web Site Rebrand',
   date('now', '-60 days'), date('now', '+120 days'),
   '#A855F7', 'globe',
   'share-mcf-rebrand-token', 'ical-mcf-rebrand-token',
   'u-scott-fitzgerald', datetime('now', '-60 days'), datetime('now', '-2 days'));
