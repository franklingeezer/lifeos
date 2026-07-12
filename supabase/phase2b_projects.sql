-- LifeOS — grants for tables created in Phase 1 that never got the explicit
-- GRANT that `tasks` needed. Run this once — cheap, idempotent, no data changes.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.projects to anon, authenticated;
grant select, insert, update, delete on public.habits to anon, authenticated;
grant select, insert, update, delete on public.habit_logs to anon, authenticated;
grant select, insert, update, delete on public.notes to anon, authenticated;
grant select, insert, update, delete on public.finance_transactions to anon, authenticated;

-- A few real projects to seed the board with, instead of staring at an empty grid.
insert into projects (name, description, category, status, priority, start_date, github_repo)
values
  ('LifeOS', 'Personal operating system — Next.js, Supabase, Tailwind.', 'Full-stack', 'active', 'high', current_date - interval '10 days', 'franklingeezer/lifeos'),
  ('Cyber Terminal', 'Browser-based cybersecurity toolkit with a cyberpunk console aesthetic and a SENTINEL AI SOC analyst.', 'Web / Security', 'active', 'high', current_date - interval '40 days', null),
  ('Elsewhere', 'Moody glassmorphism personal landing page with a Spotify song card and rotating footer wit.', 'Frontend', 'done', 'low', current_date - interval '70 days', null)
on conflict do nothing;
