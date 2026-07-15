-- ---------- Media Vault (Phase 4c) ----------

-- 1. Storage bucket (private — files are only reachable via signed URLs)
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

-- 2. Storage policies — allow the anon/authenticated roles to manage objects
--    inside the 'media' bucket. Tighten to auth.uid() checks once auth lands.
create policy "media bucket - read (pre-auth)"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media bucket - insert (pre-auth)"
  on storage.objects for insert
  with check (bucket_id = 'media');

create policy "media bucket - update (pre-auth)"
  on storage.objects for update
  using (bucket_id = 'media');

create policy "media bucket - delete (pre-auth)"
  on storage.objects for delete
  using (bucket_id = 'media');

-- 3. Metadata table — one row per uploaded file
create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id),
  storage_path text not null unique,
  file_name text not null,
  file_type text not null check (file_type in ('image', 'video', 'document', 'other')),
  mime_type text,
  size_bytes bigint,
  caption text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table media_items enable row level security;

create policy "allow all on media_items (pre-auth)"
  on media_items for all
  using (true)
  with check (true);

-- 4. Grants — required in addition to RLS, or every query 401s with 42501.
grant select, insert, update, delete on public.media_items to anon, authenticated;