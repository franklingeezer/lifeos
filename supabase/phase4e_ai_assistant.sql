-- ---------- AI Assistant — Morning Brief (Phase 4e) ----------

-- One brief per calendar date, cached so we don't call the API more than
-- once a day unless the user explicitly regenerates.
create table if not exists ai_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  brief_date date not null unique,
  content text not null,
  created_at timestamptz not null default now()
);

alter table ai_briefs enable row level security;

create policy "allow all on ai_briefs (pre-auth)"
  on ai_briefs for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.ai_briefs to anon, authenticated;

-- Projects doesn't currently track when it was last touched, which the brief
-- needs for "X hasn't been updated in N days" — add it plus a trigger.
alter table projects add column if not exists updated_at timestamptz not null default now();

create or replace function touch_project_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_project_updated_at on projects;
create trigger trg_touch_project_updated_at
before update on projects
for each row execute function touch_project_updated_at();