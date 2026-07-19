-- ---------- AI Assistant — Journal Insights (Phase 4g) ----------
create table if not exists ai_journal_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  range_type text not null check (range_type in ('30d', '90d', 'all')),
  period_start date,
  period_end date not null,
  entry_count int not null default 0,
  content text not null,
  created_at timestamptz not null default now(),
  unique (range_type, period_end)
);

alter table ai_journal_insights enable row level security;

create policy "allow all on ai_journal_insights (pre-auth)"
  on ai_journal_insights for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.ai_journal_insights to anon, authenticated;