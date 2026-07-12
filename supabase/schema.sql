-- LifeOS schema — Phase 1
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).
--
-- Auth note: real auth isn't wired up yet, so every table has a nullable
-- user_id and a permissive RLS policy for now. When Supabase Auth is added,
-- swap each "allow all" policy for one scoped to auth.uid() = user_id, and
-- make user_id not null with a default of auth.uid().

create extension if not exists "pgcrypto";

-- ---------- Tasks (used by the dashboard today) ----------
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  title text not null,
  tag text,
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  done boolean not null default false,
  position int not null default 0,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "allow all on tasks (pre-auth)"
  on tasks for all
  using (true)
  with check (true);

-- ---------- Habits (Phase 3) ----------
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references habits (id) on delete cascade,
  date date not null,
  completed boolean not null default true,
  unique (habit_id, date)
);

alter table habits enable row level security;
alter table habit_logs enable row level security;

create policy "allow all on habits (pre-auth)" on habits for all using (true) with check (true);
create policy "allow all on habit_logs (pre-auth)" on habit_logs for all using (true) with check (true);

-- ---------- Projects (Phase 2) ----------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  name text not null,
  description text,
  category text,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'archived')),
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  start_date date,
  deadline date,
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  github_repo text,
  live_demo text,
  created_at timestamptz not null default now()
);

alter table projects enable row level security;
create policy "allow all on projects (pre-auth)" on projects for all using (true) with check (true);

-- ---------- Notes (Phase 3) ----------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  title text not null,
  content text,
  folder text,
  tags text[],
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notes enable row level security;
create policy "allow all on notes (pre-auth)" on notes for all using (true) with check (true);

-- ---------- Finance (Phase 4) ----------
create table if not exists finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  type text not null check (type in ('income', 'expense', 'savings', 'investment')),
  category text,
  amount_bdt numeric not null,
  note text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table finance_transactions enable row level security;
create policy "allow all on finance_transactions (pre-auth)" on finance_transactions for all using (true) with check (true);

-- ---------- Seed a few starter tasks so the dashboard isn't empty ----------
insert into tasks (title, tag, priority, done)
values
  ('Ship SENTINEL streaming fix', 'Cyber Terminal', 'high', false),
  ('Draft LifeOS Phase 1 schema', 'LifeOS', 'med', true),
  ('Reply to GitHub issue #12', 'franklingeezer', 'low', true),
  ('Review Elsewhere footer copy', 'Elsewhere', 'low', false)
on conflict do nothing;
