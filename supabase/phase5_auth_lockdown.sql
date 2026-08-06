-- LifeOS — Phase 5: real auth + row-level lockdown
--
-- Run this AFTER you've created your Supabase Auth user (Authentication ->
-- Users -> Add user, email + password). LifeOS is single-user, so one auth
-- user is all you need — there's no public sign-up page.
--
-- What this does:
--   1. Creates the one table that was never checked into a migration
--      (finance_debts — DebtsPanel.tsx has been querying it, so it must have
--      been created by hand in the SQL editor at some point).
--   2. Makes user_id NOT NULL with a default of auth.uid() on every owned
--      table, and replaces every "allow all (pre-auth)" policy with one
--      scoped to auth.uid() = user_id.
--   3. Scopes the two child tables that don't have their own user_id
--      (subtasks, habit_logs) via their parent row's owner.
--   4. Scopes app_settings (a singleton, no user_id) and the media storage
--      bucket to "must be logged in" rather than "must own the row" — that's
--      the correct model for a single-user app.
--   5. Backfills existing NULL user_id rows to your account — read step 0
--      below before running.
--
-- ============================================================================
-- STEP 0 — before running the rest of this file, grab your user id:
--   select id from auth.users where email = 'you@example.com';
-- Paste that uuid in place of YOUR_USER_ID_HERE everywhere below (Ctrl+H
-- in most editors), or just define it once here and every DO block will
-- pick it up:
-- ============================================================================

do $$
declare
  target_user uuid := '721d622d-f506-40d0-9a6b-ec6dc3cb6b30'; -- <-- replace before running
begin
  if target_user is null then
    raise exception 'Set target_user to your auth.users id before running this migration.';
  end if;

  -- ---------- backfill existing rows so you don't lose access to them ----------
  update tasks set user_id = target_user where user_id is null;
  update habits set user_id = target_user where user_id is null;
  update projects set user_id = target_user where user_id is null;
  update notes set user_id = target_user where user_id is null;
  update finance_transactions set user_id = target_user where user_id is null;
  update events set user_id = target_user where user_id is null;
  update journal_entries set user_id = target_user where user_id is null;
  update learning_items set user_id = target_user where user_id is null;
  update media_items set user_id = target_user where user_id is null;
  update idea_vault_items set user_id = target_user where user_id is null;
  update ai_briefs set user_id = target_user where user_id is null;
  update ai_reviews set user_id = target_user where user_id is null;
  update ai_journal_insights set user_id = target_user where user_id is null;
end $$;

-- ============================================================================
-- finance_debts — recreating it here since no prior migration defines it,
-- even though DebtsPanel.tsx has been reading/writing it. Columns inferred
-- from that component. Safe to run even if the table already exists.
-- ============================================================================
create table if not exists finance_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  person_name text not null,
  direction text not null check (direction in ('owed_to_me', 'i_owe')),
  amount_bdt numeric not null,
  note text,
  due_date date,
  settled boolean not null default false,
  created_at timestamptz not null default now()
);

alter table finance_debts enable row level security;
grant select, insert, update, delete on public.finance_debts to authenticated;

drop policy if exists "finance_debts owner select" on finance_debts;
drop policy if exists "finance_debts owner all" on finance_debts;
create policy "finance_debts owner all" on finance_debts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- Helper macro (as a comment, since Postgres has no real macros): for every
-- owned table below we do the same three things —
--   alter column user_id set not null / set default auth.uid()
--   drop the old "allow all (pre-auth)" policy
--   create one "owner all" policy scoped to auth.uid() = user_id
-- ============================================================================

-- ---------- tasks ----------
alter table tasks alter column user_id set default auth.uid();
alter table tasks alter column user_id set not null;
drop policy if exists "allow all on tasks (pre-auth)" on tasks;
create policy "tasks owner all" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- subtasks (no user_id — scoped through parent task) ----------
drop policy if exists "allow all on subtasks (pre-auth)" on subtasks;
create policy "subtasks owner all" on subtasks
  for all
  using (exists (select 1 from tasks t where t.id = subtasks.task_id and t.user_id = auth.uid()))
  with check (exists (select 1 from tasks t where t.id = subtasks.task_id and t.user_id = auth.uid()));

-- ---------- habits ----------
alter table habits alter column user_id set default auth.uid();
alter table habits alter column user_id set not null;
drop policy if exists "allow all on habits (pre-auth)" on habits;
create policy "habits owner all" on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- habit_logs (no user_id — scoped through parent habit) ----------
drop policy if exists "allow all on habit_logs (pre-auth)" on habit_logs;
create policy "habit_logs owner all" on habit_logs
  for all
  using (exists (select 1 from habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid()))
  with check (exists (select 1 from habits h where h.id = habit_logs.habit_id and h.user_id = auth.uid()));

-- ---------- projects ----------
alter table projects alter column user_id set default auth.uid();
alter table projects alter column user_id set not null;
drop policy if exists "allow all on projects (pre-auth)" on projects;
create policy "projects owner all" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- notes ----------
alter table notes alter column user_id set default auth.uid();
alter table notes alter column user_id set not null;
drop policy if exists "allow all on notes (pre-auth)" on notes;
create policy "notes owner all" on notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- finance_transactions ----------
alter table finance_transactions alter column user_id set default auth.uid();
alter table finance_transactions alter column user_id set not null;
drop policy if exists "allow all on finance_transactions (pre-auth)" on finance_transactions;
create policy "finance_transactions owner all" on finance_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- events (calendar) ----------
alter table events alter column user_id set default auth.uid();
alter table events alter column user_id set not null;
drop policy if exists "allow all on events (pre-auth)" on events;
create policy "events owner all" on events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- journal_entries ----------
alter table journal_entries alter column user_id set default auth.uid();
alter table journal_entries alter column user_id set not null;
drop policy if exists "allow all on journal_entries (pre-auth)" on journal_entries;
create policy "journal_entries owner all" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- learning_items ----------
alter table learning_items alter column user_id set default auth.uid();
alter table learning_items alter column user_id set not null;
drop policy if exists "allow all on learning_items (pre-auth)" on learning_items;
create policy "learning_items owner all" on learning_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- media_items ----------
alter table media_items alter column user_id set default auth.uid();
alter table media_items alter column user_id set not null;
drop policy if exists "allow all on media_items (pre-auth)" on media_items;
create policy "media_items owner all" on media_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- media storage bucket (must be logged in; single-user app so
-- "authenticated" is an acceptable proxy for "owner" here) ----------
drop policy if exists "media bucket - read (pre-auth)" on storage.objects;
drop policy if exists "media bucket - insert (pre-auth)" on storage.objects;
drop policy if exists "media bucket - update (pre-auth)" on storage.objects;
drop policy if exists "media bucket - delete (pre-auth)" on storage.objects;

create policy "media bucket - authenticated only"
  on storage.objects for all
  using (bucket_id = 'media' and auth.role() = 'authenticated')
  with check (bucket_id = 'media' and auth.role() = 'authenticated');

-- ---------- idea_vault_items ----------
alter table idea_vault_items alter column user_id set default auth.uid();
alter table idea_vault_items alter column user_id set not null;
drop policy if exists "allow all on idea_vault_items (pre-auth)" on idea_vault_items;
create policy "idea_vault_items owner all" on idea_vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- ai_briefs / ai_reviews / ai_journal_insights ----------
alter table ai_briefs alter column user_id set default auth.uid();
alter table ai_briefs alter column user_id set not null;
drop policy if exists "allow all on ai_briefs (pre-auth)" on ai_briefs;
create policy "ai_briefs owner all" on ai_briefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table ai_reviews alter column user_id set default auth.uid();
alter table ai_reviews alter column user_id set not null;
drop policy if exists "allow all on ai_reviews (pre-auth)" on ai_reviews;
create policy "ai_reviews owner all" on ai_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table ai_journal_insights alter column user_id set default auth.uid();
alter table ai_journal_insights alter column user_id set not null;
drop policy if exists "allow all on ai_journal_insights (pre-auth)" on ai_journal_insights;
create policy "ai_journal_insights owner all" on ai_journal_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- app_settings (singleton, no user_id — gate on "logged in") ----------
drop policy if exists "allow all on app_settings (pre-auth)" on app_settings;
create policy "app_settings authenticated only" on app_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================================
-- Grants — RLS is necessary but not sufficient; Supabase also needs the
-- table-level grant. The "anon" role no longer needs any of these since
-- everything now requires a logged-in session.
-- ============================================================================
revoke all on public.tasks, public.subtasks, public.habits, public.habit_logs,
  public.projects, public.notes, public.finance_transactions, public.finance_debts,
  public.events, public.journal_entries, public.learning_items, public.media_items,
  public.idea_vault_items, public.ai_briefs, public.ai_reviews,
  public.ai_journal_insights, public.app_settings
  from anon;

grant select, insert, update, delete on
  public.tasks, public.subtasks, public.habits, public.habit_logs,
  public.projects, public.notes, public.finance_transactions, public.finance_debts,
  public.events, public.journal_entries, public.learning_items, public.media_items,
  public.idea_vault_items, public.ai_briefs, public.ai_reviews,
  public.ai_journal_insights, public.app_settings
  to authenticated;