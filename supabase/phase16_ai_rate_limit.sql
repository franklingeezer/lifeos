-- LifeOS — Phase 16: per-user, persistent AI rate limiting
--
-- Replaces lib/ai-rate-limit.ts's in-memory Map. That approach only
-- worked because the comment in the old file assumed a single Node
-- process — true for `npm run start` on one machine, false the moment
-- this actually deployed to Vercel (serverless, multiple instances, no
-- shared memory between them). It also had a second, separate bug: every
-- route called checkAIRateLimit() with no key, so it was ONE shared
-- bucket across every user of the app, not one per user — with 2 real
-- accounts now active, one person's usage could lock the other out
-- entirely. This migration fixes both at once.

create table if not exists ai_rate_limit_buckets (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

alter table ai_rate_limit_buckets enable row level security;
grant select, insert, update on public.ai_rate_limit_buckets to authenticated;

-- Owner-scoped like everything else — key is always the caller's own
-- auth.uid() (as text), set server-side from their session, never
-- user-suppliable, so there's no way to read or perturb someone else's
-- bucket even though this table doesn't have a user_id column in the
-- usual sense.
create policy "ai_rate_limit_buckets owner all" on ai_rate_limit_buckets
  for all using (key = auth.uid()::text) with check (key = auth.uid()::text);

-- INSERT ... ON CONFLICT DO UPDATE makes the read-check-write sequence a
-- single atomic statement at the database level — a real correctness
-- improvement over the old in-memory version, which could race under
-- concurrent requests within the same process too, not just across
-- serverless instances.
create or replace function check_ai_rate_limit(p_key text, p_window_ms bigint, p_max_requests int)
returns table(allowed boolean, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count int;
  v_cutoff timestamptz;
begin
  v_cutoff := v_now - (p_window_ms || ' milliseconds')::interval;

  insert into ai_rate_limit_buckets (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update set
    count = case
      when ai_rate_limit_buckets.window_start < v_cutoff then 1
      else ai_rate_limit_buckets.count + 1
    end,
    window_start = case
      when ai_rate_limit_buckets.window_start < v_cutoff then v_now
      else ai_rate_limit_buckets.window_start
    end
  returning ai_rate_limit_buckets.count, ai_rate_limit_buckets.window_start into v_count, v_window_start;

  if v_count > p_max_requests then
    return query select false, greatest(0, ceil(extract(epoch from (v_window_start + (p_window_ms || ' milliseconds')::interval - v_now))))::int;
  else
    return query select true, 0;
  end if;
end;
$$;