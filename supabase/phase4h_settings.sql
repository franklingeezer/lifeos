-- ---------- Settings (Phase 4h) ----------
-- Single-row config table. Not per-user since LifeOS has no auth yet —
-- one settings row for the whole app.
create table if not exists app_settings (
  id int primary key default 1,
  display_name text not null default 'Chief',
  currency_code text not null default 'BDT',
  currency_symbol text not null default '৳',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;

create policy "allow all on app_settings (pre-auth)"
  on app_settings for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.app_settings to anon, authenticated;