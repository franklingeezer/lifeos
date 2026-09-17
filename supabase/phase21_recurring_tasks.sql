-- LifeOS Roadmap — Recurring Tasks, Part 1 (schema)
--
-- A `repeat_rule` already exists on Reminders (phase8) but is currently
-- dead code — the notification cron's own dedup check permanently blocks
-- a second notification for the same reminder row, so nothing ever acts
-- on it. This is a deliberately separate, proper design rather than
-- wiring up that unused field: a single row can't represent "infinite
-- future occurrences" if you also want to complete, edit, or delete one
-- occurrence without touching the rest — you need a series that
-- generates real, independent rows.
--
-- task_series is the template ("every Monday/Wednesday/Friday", "the 1st
-- of every month"); each actual occurrence is a normal row in `tasks`,
-- linked back via tasks.series_id. A completed or edited occurrence is
-- just a normal task — nothing about the series needs to know or care.
--
-- Built directly on the post-auth ownership pattern from the start
-- (owner-scoped RLS immediately), same as phase12_inbox.sql — there's no
-- reason for a brand-new table in an already-authed app to be open even
-- temporarily.
create table if not exists task_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  title text not null,
  category text,
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  project_id uuid references projects (id) on delete set null,
  estimated_minutes int,

  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  -- Every Nth day/week/month — "every 2 weeks", not just "every week".
  interval_count int not null default 1 check (interval_count >= 1),
  -- Weekly only. 0=Sun..6=Sat, matching JS Date.getDay() so the app never
  -- has to translate between two different day-numbering conventions.
  days_of_week smallint[],
  -- Monthly only. 1-31; a month shorter than this day just skips that
  -- month rather than rolling over — app-level generation logic decides
  -- that, not a DB constraint.
  day_of_month smallint check (day_of_month between 1 and 31),

  start_date date not null,
  -- Null means "runs forever" — most series won't have a planned end.
  end_date date,
  -- Pausing stops new occurrences from generating without deleting the
  -- series definition or any history already generated from it.
  active boolean not null default true,
  -- Cached pointer to the next date this series still needs an occurrence
  -- generated for. Avoids recomputing "what's the next due date" from
  -- start_date + frequency math on every single cron run — the
  -- generator only ever needs to look at series where next_due_date has
  -- actually arrived.
  next_due_date date not null,

  created_at timestamptz not null default now()
);

-- Bug precedent worth repeating here: task_series.days_of_week is a
-- smallint[], stored per-series — the app is responsible for only
-- ever reading/writing it with 0=Sun..6=Sat, since Postgres has no way
-- to enforce that convention itself.

alter table tasks add column if not exists series_id uuid references task_series (id) on delete set null;
-- SET NULL, not CASCADE, mirroring events.task_id from phase19 — deleting
-- or pausing a series should never delete a task instance that already
-- has its own history (completed, edited, linked to other things). It
-- just stops being tied to a series that no longer generates new ones.

create index if not exists task_series_active_due_idx on task_series (user_id, active, next_due_date);
create index if not exists tasks_series_id_idx on tasks (series_id);

alter table task_series enable row level security;
grant select, insert, update, delete on public.task_series to authenticated;

create policy "task_series owner all" on task_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);