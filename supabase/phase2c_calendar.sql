-- LifeOS — Phase 2 (Calendar)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  title text not null,
  date date not null,
  color text not null default '#5EA8A0',
  all_day boolean not null default true,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

drop policy if exists "allow all on events (pre-auth)" on events;
create policy "allow all on events (pre-auth)"
  on events for all
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.events to anon, authenticated;