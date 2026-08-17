-- LifeOS — Phase 12: Inbox (quick capture)
--
-- A universal, ungated capture bucket — see the "LifeOS — Inbox System"
-- doc for the full design. The point is speed: a thought lands here with
-- zero required decisions, and gets turned into a real Task/Note/Idea/
-- Project/Event/Reminder later (Part 3). converted_type/converted_id keep
-- that conversion traceable after the fact, but deliberately aren't a real
-- foreign key — the target table varies (tasks vs notes vs ...), and
-- Postgres FKs can't point at "whichever table converted_type says."
--
-- Built directly on the post-auth ownership pattern (owner-scoped RLS from
-- the start) rather than the old "pre-auth allow all, lock down later"
-- two-step earlier tables went through — there's no reason for a
-- brand-new table in an already-authed app to be open even temporarily.

create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) default auth.uid(),
  content text not null,
  status text not null default 'inbox' check (status in ('inbox', 'processed', 'archived')),
  priority smallint check (priority between 1 and 5),
  tags text[] not null default '{}',
  converted_type text check (converted_type in ('task', 'note', 'idea', 'project', 'event', 'reminder')),
  converted_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists inbox_items_user_status_idx on inbox_items (user_id, status, created_at desc);

alter table inbox_items enable row level security;
grant select, insert, update, delete on public.inbox_items to authenticated;

create policy "inbox_items owner all" on inbox_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);