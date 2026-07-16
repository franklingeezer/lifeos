-- ---------- AI Assistant — Weekly / Monthly Reviews (Phase 4f) ----------
create table if not exists ai_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  period_type text not null check (period_type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (period_type, period_start)
);

alter table ai_reviews enable row level security;

create policy "allow all on ai_reviews (pre-auth)"
  on ai_reviews for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.ai_reviews to anon, authenticated;