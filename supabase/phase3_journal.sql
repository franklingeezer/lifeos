-- LifeOS — Phase 3 (Journal)
create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  entry_date date not null unique,
  mood int not null default 3 check (mood between 1 and 5),
  energy int not null default 3 check (energy between 1 and 5),
  stress int not null default 3 check (stress between 1 and 5),
  wins text,
  failures text,
  lessons text,
  tomorrow_goals text,
  gratitude text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table journal_entries enable row level security;

drop policy if exists "allow all on journal_entries (pre-auth)" on journal_entries;
create policy "allow all on journal_entries (pre-auth)"
  on journal_entries for all
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.journal_entries to anon, authenticated;