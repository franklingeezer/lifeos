-- LifeOS — Phase 23: table privileges for the service role (cron jobs)
--
-- Why this exists: every earlier migration grants table privileges only to
-- `anon` / `authenticated` (the browser's roles). The cron route
-- (app/api/cron/notifications/route.ts) uses the service-role key, which
-- bypasses Row Level Security — but bypassing RLS is not the same as having
-- table privileges. If service_role was never granted access to a table,
-- every query the cron makes fails with "permission denied for table ...".
--
-- Until the middleware fix, the cron never actually reached its route, so
-- this had never been exercised. Run once in the Supabase SQL Editor.
-- Safe to re-run: GRANT and REVOKE are idempotent.
--
-- Least privilege: each table gets exactly the operations the cron performs
-- on it, and nothing more. In particular the service role is NOT allowed to
-- delete tasks, series, reminders or notifications — the cron never needs to.

grant usage on schema public to service_role;

grant select, update          on public.task_series         to service_role;  -- find due series, advance next_due_date
grant select, insert          on public.tasks               to service_role;  -- read overdue tasks, create recurring occurrences
grant select                  on public.reminders           to service_role;  -- read due reminders
grant select, insert, update  on public.notifications       to service_role;  -- create, read, mark as pushed
grant select, delete          on public.push_subscriptions  to service_role;  -- read subscriptions, drop expired ones

-- If an earlier, broader version of this migration was already run, take
-- back everything the cron doesn't use. (No-ops if it was never granted.)
revoke insert, delete         on public.task_series         from service_role;
revoke update, delete         on public.tasks               from service_role;
revoke insert, update, delete on public.reminders           from service_role;
revoke delete                 on public.notifications       from service_role;
revoke insert, update         on public.push_subscriptions  from service_role;