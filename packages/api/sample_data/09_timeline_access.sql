-- Timeline access: all team members get access to their team's timelines.
-- Team admins get 'admin' role, team members get 'member' role.

-- Product Marketing timelines
INSERT INTO timeline_access (timeline_id, team_member_id, role) VALUES
  ('tl-pm-q1',  'tm-pm-brian',      'admin'),
  ('tl-pm-q1',  'tm-pm-lindsay',    'member'),
  ('tl-pm-q1',  'tm-pm-erik',       'admin'),
  ('tl-pm-q1',  'tm-pm-michelle',   'member'),
  ('tl-pm-q1',  'tm-pm-contractor', 'member'),
  ('tl-pm-sko', 'tm-pm-brian',      'admin'),
  ('tl-pm-sko', 'tm-pm-lindsay',    'member'),
  ('tl-pm-sko', 'tm-pm-erik',       'admin'),
  ('tl-pm-sko', 'tm-pm-michelle',   'member'),
  ('tl-pm-sko', 'tm-pm-contractor', 'member'),
  ('tl-pm-q2',  'tm-pm-brian',      'admin'),
  ('tl-pm-q2',  'tm-pm-lindsay',    'member'),
  ('tl-pm-q2',  'tm-pm-erik',       'admin'),
  ('tl-pm-q2',  'tm-pm-michelle',   'member'),
  ('tl-pm-q2',  'tm-pm-contractor', 'member');

-- P&B Tiger Team timelines
INSERT INTO timeline_access (timeline_id, team_member_id, role) VALUES
  ('tl-pb-rtw', 'tm-pb-brian',   'admin'),
  ('tl-pb-rtw', 'tm-pb-scott',   'member'),
  ('tl-pb-rtw', 'tm-pb-codi',    'admin'),
  ('tl-pb-rtw', 'tm-pb-dan',     'member'),
  ('tl-pb-rtw', 'tm-pb-kristen', 'member'),
  ('tl-pb-rtw', 'tm-pb-jamie',   'member'),
  ('tl-pb-gtm', 'tm-pb-brian',   'admin'),
  ('tl-pb-gtm', 'tm-pb-scott',   'member'),
  ('tl-pb-gtm', 'tm-pb-codi',    'admin'),
  ('tl-pb-gtm', 'tm-pb-dan',     'member'),
  ('tl-pb-gtm', 'tm-pb-kristen', 'member'),
  ('tl-pb-gtm', 'tm-pb-jamie',   'member');

-- Marketing Cross Functional timelines
INSERT INTO timeline_access (timeline_id, team_member_id, role) VALUES
  ('tl-mcf-rebrand', 'tm-mcf-scott', 'admin'),
  ('tl-mcf-rebrand', 'tm-mcf-paula', 'admin'),
  ('tl-mcf-rebrand', 'tm-mcf-corey', 'member'),
  ('tl-mcf-rebrand', 'tm-mcf-dan',   'member'),
  ('tl-mcf-rebrand', 'tm-mcf-rick',  'member');
