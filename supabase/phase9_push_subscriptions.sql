-- LifeOS — Phase 9: Web Push subscriptions
--
-- One row per browser/device that's granted push permission (you might
-- have LifeOS installed on your phone AND your laptop — each gets its own
-- subscription and its own row). `endpoint` is unique because the same
-- endpoint re-subscribing (e.g. permission re-granted) should update the
-- existing row, not create a duplicate that then gets double-notified.
--
-- Same ownership model as reminders/notifications (phase8): user_id
-- defaults to auth.uid(), RLS scopes everything to the owning row.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Free-text label so the Settings UI (Part 4) can show "this device" vs
  -- others meaningfully instead of a bare endpoint URL.
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_subscriptions owner all" on push_subscriptions;
create policy "push_subscriptions owner all" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);