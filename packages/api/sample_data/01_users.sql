-- Users: 13 total (2 super admins).
-- Password for all users: "password" (bcrypt cost 12).
-- Icon: __name_words__ (initials badge) for all users.

INSERT INTO users (id, email, password_hash, display_name, color, icon, is_superadmin, created_at, updated_at) VALUES
  ('u-brian-rieb',        'brian@rieb.cc',             '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Brian Rieb',        '#3B82F6', '__name_words__', 1, datetime('now', '-90 days'), datetime('now', '-1 days')),
  ('u-scott-fitzgerald',  'scott@fitzgerald.example',  '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Scott Fitzgerald',  '#8B5CF6', '__name_words__', 1, datetime('now', '-90 days'), datetime('now', '-2 days')),
  ('u-lindsay-k',         'lindsay.k@example.com',     '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Lindsay K.',        '#EC4899', '__name_words__', 0, datetime('now', '-85 days'), datetime('now', '-3 days')),
  ('u-erik-b',            'erik.b@example.com',        '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Erik B',            '#F97316', '__name_words__', 0, datetime('now', '-85 days'), datetime('now', '-3 days')),
  ('u-michelle-t',        'michelle.t@example.com',    '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Michelle T',        '#22C55E', '__name_words__', 0, datetime('now', '-80 days'), datetime('now', '-5 days')),
  ('u-codi-k',            'codi.k@example.com',        '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Codi K',            '#06B6D4', '__name_words__', 0, datetime('now', '-88 days'), datetime('now', '-10 days')),
  ('u-dan-s',             'dan.s@example.com',         '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Dan S',             '#F43F5E', '__name_words__', 0, datetime('now', '-88 days'), datetime('now', '-10 days')),
  ('u-kristen-k',         'kristen.k@example.com',     '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Kristen K',         '#F59E0B', '__name_words__', 0, datetime('now', '-88 days'), datetime('now', '-10 days')),
  ('u-jamie-f',           'jamie.f@example.com',       '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Jamie F',           '#84CC16', '__name_words__', 0, datetime('now', '-88 days'), datetime('now', '-10 days')),
  ('u-paula-h',           'paula.h@example.com',       '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Paula H',           '#A855F7', '__name_words__', 0, datetime('now', '-75 days'), datetime('now', '-4 days')),
  ('u-corey-f',           'corey.f@example.com',       '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Corey F',           '#EF4444', '__name_words__', 0, datetime('now', '-75 days'), datetime('now', '-6 days')),
  ('u-dan-b',             'dan.b@example.com',         '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Dan B',             '#6366F1', '__name_words__', 0, datetime('now', '-75 days'), datetime('now', '-6 days')),
  ('u-rick-s',            'rick.s@example.com',        '$2a$12$WKzPgLht8GL4iR76X0JfYuFw.4GqjricAMaKQPvA7ae8hiJp225dG', 'Rick S',            '#288C9B', '__name_words__', 0, datetime('now', '-75 days'), datetime('now', '-7 days'));
