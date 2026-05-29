-- Team members: 16 total (includes 1 external participant with user_id=NULL).
-- Icon: __name_words__ (initials badge) for all members.

-- Product Marketing (5 members: 2 admin, 2 member, 1 external participant)
INSERT INTO team_members (id, team_id, user_id, display_name, role, color, icon, joined_at) VALUES
  ('tm-pm-brian',      't-product-marketing', 'u-brian-rieb',  NULL,         'admin',  '#3B82F6', '__name_words__', datetime('now', '-90 days')),
  ('tm-pm-lindsay',    't-product-marketing', 'u-lindsay-k',  NULL,         'member', '#EC4899', '__name_words__', datetime('now', '-85 days')),
  ('tm-pm-erik',       't-product-marketing', 'u-erik-b',     NULL,         'admin',  '#F97316', '__name_words__', datetime('now', '-85 days')),
  ('tm-pm-michelle',   't-product-marketing', 'u-michelle-t', NULL,         'member', '#22C55E', '__name_words__', datetime('now', '-80 days')),
  ('tm-pm-contractor', 't-product-marketing', NULL,           'Contractor', 'member', '#64748B', '__name_words__', datetime('now', '-70 days'));

-- P&B Tiger Team (6 members: 2 admin, 4 member)
INSERT INTO team_members (id, team_id, user_id, display_name, role, color, icon, joined_at) VALUES
  ('tm-pb-brian',   't-pb-tiger-team', 'u-brian-rieb',       NULL, 'admin',  '#3B82F6', '__name_words__', datetime('now', '-88 days')),
  ('tm-pb-scott',   't-pb-tiger-team', 'u-scott-fitzgerald', NULL, 'member', '#8B5CF6', '__name_words__', datetime('now', '-88 days')),
  ('tm-pb-codi',    't-pb-tiger-team', 'u-codi-k',          NULL, 'admin',  '#06B6D4', '__name_words__', datetime('now', '-88 days')),
  ('tm-pb-dan',     't-pb-tiger-team', 'u-dan-s',           NULL, 'member', '#F43F5E', '__name_words__', datetime('now', '-88 days')),
  ('tm-pb-kristen', 't-pb-tiger-team', 'u-kristen-k',       NULL, 'member', '#F59E0B', '__name_words__', datetime('now', '-88 days')),
  ('tm-pb-jamie',   't-pb-tiger-team', 'u-jamie-f',         NULL, 'member', '#84CC16', '__name_words__', datetime('now', '-88 days'));

-- Marketing Cross Functional (6 members: 3 admin, 3 member)
-- Brian added as admin so super admins can test all teams until superadmin
-- team-access bypass is implemented.
INSERT INTO team_members (id, team_id, user_id, display_name, role, color, icon, joined_at) VALUES
  ('tm-mcf-brian', 't-marketing-cross-func', 'u-brian-rieb',       NULL, 'admin',  '#3B82F6', '__name_words__', datetime('now', '-75 days')),
  ('tm-mcf-scott', 't-marketing-cross-func', 'u-scott-fitzgerald', NULL, 'admin',  '#8B5CF6', '__name_words__', datetime('now', '-75 days')),
  ('tm-mcf-paula', 't-marketing-cross-func', 'u-paula-h',         NULL, 'admin',  '#A855F7', '__name_words__', datetime('now', '-75 days')),
  ('tm-mcf-corey', 't-marketing-cross-func', 'u-corey-f',         NULL, 'member', '#EF4444', '__name_words__', datetime('now', '-75 days')),
  ('tm-mcf-dan',   't-marketing-cross-func', 'u-dan-b',           NULL, 'member', '#6366F1', '__name_words__', datetime('now', '-75 days')),
  ('tm-mcf-rick',  't-marketing-cross-func', 'u-rick-s',          NULL, 'member', '#288C9B', '__name_words__', datetime('now', '-75 days'));
