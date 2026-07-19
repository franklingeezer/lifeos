-- LifeOS — Phase 4 (Learning Tracker)
create table if not exists learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  title text not null,
  category text,
  status text not null default 'in_progress' check (status in ('not_started', 'in_progress', 'completed')),
  progress int not null default 0 check (progress >= 0 and progress <= 100),
  hours_studied numeric not null default 0,
  resource_url text,
  notes text,
  quiz_score numeric,
  has_certificate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table learning_items enable row level security;

drop policy if exists "allow all on learning_items (pre-auth)" on learning_items;
create policy "allow all on learning_items (pre-auth)"
  on learning_items for all
  using (true)
  with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.learning_items to anon, authenticated;