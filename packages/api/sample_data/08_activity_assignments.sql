-- Activity assignments: links activities to team members.
-- Q1 Workload: mostly single-person. SKO: multi-person. Others: single.

-- Q1 Workload
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-q1-01', 'tm-pm-brian'),
  ('a-q1-02', 'tm-pm-brian'),
  ('a-q1-03', 'tm-pm-lindsay'),
  ('a-q1-04', 'tm-pm-erik'),
  ('a-q1-05', 'tm-pm-erik'),
  ('a-q1-06', 'tm-pm-brian'),
  ('a-q1-07', 'tm-pm-michelle'),
  ('a-q1-08', 'tm-pm-brian'),
  ('a-q1-09', 'tm-pm-lindsay'),
  ('a-q1-10', 'tm-pm-michelle'),
  ('a-q1-11', 'tm-pm-lindsay'),
  ('a-q1-12', 'tm-pm-erik'),
  ('a-q1-13', 'tm-pm-brian'),
  ('a-q1-14', 'tm-pm-erik'),
  ('a-q1-15', 'tm-pm-michelle'),
  ('a-q1-16', 'tm-pm-brian'),
  ('a-q1-17', 'tm-pm-erik'),
  ('a-q1-18', 'tm-pm-brian'),
  ('a-q1-19', 'tm-pm-lindsay'),
  ('a-q1-20', 'tm-pm-brian');

-- Sales Kick Off (multi-person assignments)
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-sko-01', 'tm-pm-erik'),
  ('a-sko-01', 'tm-pm-brian'),
  ('a-sko-02', 'tm-pm-brian'),
  ('a-sko-02', 'tm-pm-erik'),
  ('a-sko-02', 'tm-pm-lindsay'),
  ('a-sko-03', 'tm-pm-erik'),
  ('a-sko-03', 'tm-pm-brian'),
  ('a-sko-04', 'tm-pm-lindsay'),
  ('a-sko-04', 'tm-pm-michelle'),
  ('a-sko-05', 'tm-pm-brian'),
  ('a-sko-05', 'tm-pm-erik'),
  ('a-sko-06', 'tm-pm-michelle'),
  ('a-sko-06', 'tm-pm-contractor'),
  ('a-sko-07', 'tm-pm-brian'),
  ('a-sko-07', 'tm-pm-erik'),
  ('a-sko-08', 'tm-pm-lindsay'),
  ('a-sko-08', 'tm-pm-contractor'),
  ('a-sko-09', 'tm-pm-erik'),
  ('a-sko-09', 'tm-pm-brian'),
  ('a-sko-10', 'tm-pm-michelle'),
  ('a-sko-10', 'tm-pm-lindsay');

-- Q2 Workload
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-q2-01', 'tm-pm-brian'),
  ('a-q2-02', 'tm-pm-erik'),
  ('a-q2-03', 'tm-pm-lindsay'),
  ('a-q2-04', 'tm-pm-brian'),
  ('a-q2-05', 'tm-pm-michelle');

-- Right to Win Initiative
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-rtw-01', 'tm-pb-dan'),
  ('a-rtw-02', 'tm-pb-kristen'),
  ('a-rtw-03', 'tm-pb-brian'),
  ('a-rtw-04', 'tm-pb-codi');

-- Displacement GTM
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-gtm-01', 'tm-pb-codi'),
  ('a-gtm-02', 'tm-pb-dan'),
  ('a-gtm-03', 'tm-pb-jamie'),
  ('a-gtm-04', 'tm-pb-scott');

-- Web Site Rebrand
INSERT INTO activity_assignments (activity_id, team_member_id) VALUES
  ('a-reb-01', 'tm-mcf-scott'),
  ('a-reb-02', 'tm-mcf-paula'),
  ('a-reb-03', 'tm-mcf-corey'),
  ('a-reb-04', 'tm-mcf-rick'),
  ('a-reb-05', 'tm-mcf-dan'),
  ('a-reb-06', 'tm-mcf-rick'),
  ('a-reb-07', 'tm-mcf-corey'),
  ('a-reb-08', 'tm-mcf-scott'),
  ('a-reb-09', 'tm-mcf-paula'),
  ('a-reb-10', 'tm-mcf-scott'),
  ('a-reb-11', 'tm-mcf-paula'),
  ('a-reb-12', 'tm-mcf-dan'),
  ('a-reb-13', 'tm-mcf-rick'),
  ('a-reb-14', 'tm-mcf-scott'),
  ('a-reb-15', 'tm-mcf-rick');
