-- ---------- Idea Vault (Phase 4d) ----------
create table if not exists idea_vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  title text not null,
  description text,
  status text not null default 'spark' check (status in ('spark', 'developing', 'validated', 'archived')),
  tags text[] not null default '{}',
  potential smallint not null default 3 check (potential between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table idea_vault_items enable row level security;

create policy "allow all on idea_vault_items (pre-auth)"
  on idea_vault_items for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.idea_vault_items to anon, authenticated;