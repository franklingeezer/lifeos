-- ---------- Today Brain — daily focus plan (Phase 17 / Roadmap Phase 2) ----------

-- One focus plan per calendar date, cached the same way ai_briefs is —
-- generated once per day unless explicitly regenerated. Created directly
-- with owner-scoped RLS (unlike ai_briefs/ai_reviews/ai_journal_insights,
-- which started as "allow all" and got locked down later in phase5) since
-- the app is already past that pre-auth stage.
create table if not exists ai_today_focus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  focus_date date not null unique,
  -- {headline: string, focus_items: {order, type, ref_id, title, reason}[]}
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table ai_today_focus enable row level security;

create policy "ai_today_focus owner all" on ai_today_focus
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.ai_today_focus to authenticated;