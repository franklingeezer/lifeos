-- LifeOS — Notification System, Part 1: reminders + notifications
--
-- Two separate tables on purpose, matching the design: a reminder is
-- "what should happen and when" (something scheduled, once or recurring);
-- a notification is "LifeOS telling you the reminder/alert is ready."
-- Keeping them apart is what makes read/dismiss state, recurring
-- reminders, and (later) multiple delivery channels manageable
-- independently instead of tangled into one table.
--
-- This migration only covers Phase 1 (MVP) from the design doc: in-app
-- only, no delivery channel logic yet, no quiet hours, no repeat
-- automation beyond storing the rule for later phases to use.

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  title text not null,
  description text,
  -- What this reminder is about, if anything — lets the notification
  -- center deep-link back to the actual task/event/project/etc. Both
  -- nullable together: a reminder can be freestanding ("call the dentist")
  -- with no LifeOS item behind it at all.
  related_type text check (related_type in ('task', 'event', 'project', 'habit', 'journal', 'finance')),
  related_id uuid,
  scheduled_at timestamptz not null,
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'daily', 'weekly', 'monthly', 'custom')),
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_scheduled_idx on reminders (user_id, scheduled_at);

alter table reminders enable row level security;
grant select, insert, update, delete on public.reminders to authenticated;

drop policy if exists "reminders owner all" on reminders;
create policy "reminders owner all" on reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  -- 'reminder' = generated from a row in the reminders table above.
  -- The others are system-generated alerts LifeOS notices on its own
  -- (Phase 2+) without the user ever creating a reminder for them.
  type text not null check (type in ('reminder', 'overdue_task', 'habit_slip', 'project_inactive', 'ai_insight')),
  title text not null,
  message text,
  related_type text check (related_type in ('task', 'event', 'project', 'habit', 'journal', 'finance')),
  related_id uuid,
  reminder_id uuid references reminders (id) on delete set null,
  scheduled_at timestamptz not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_scheduled_idx on notifications (user_id, scheduled_at);
create index if not exists notifications_user_unread_idx on notifications (user_id) where dismissed_at is null;

alter table notifications enable row level security;
grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists "notifications owner all" on notifications;
create policy "notifications owner all" on notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);