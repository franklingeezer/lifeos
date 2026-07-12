-- LifeOS — Phase 2 migration (Tasks CRUD + Kanban)
-- Run this in the Supabase SQL editor, same as before.
-- Safe to run even though `tasks` already has data — uses IF NOT EXISTS / additive changes.

alter table tasks
  add column if not exists status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  add column if not exists category text;

-- Backfill status for existing rows from the old `done` boolean.
update tasks set status = 'done' where done = true and status = 'todo';

-- `done` stays as a convenience column (the dashboard widget already reads it).
-- From now on, `status` is the source of truth — this trigger keeps `done` in sync
-- whenever `status` changes, so old code doesn't break.
create or replace function sync_task_done()
returns trigger as $$
begin
  new.done := (new.status = 'done');
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_task_done on tasks;
create trigger trg_sync_task_done
before insert or update on tasks
for each row execute function sync_task_done();

-- Subtasks
create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks (id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table subtasks enable row level security;

drop policy if exists "allow all on subtasks (pre-auth)" on subtasks;
create policy "allow all on subtasks (pre-auth)"
  on subtasks for all
  using (true)
  with check (true);

-- Same grant fix as Phase 1 — needed or you'll hit the same 401/permission error.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.subtasks to anon, authenticated;
grant select, insert, update, delete on public.tasks to anon, authenticated;
