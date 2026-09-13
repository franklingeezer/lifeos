-- LifeOS Roadmap — Personal Activity, Part 2: Spotify (schema)
--
-- Singleton table, same "id int primary key default 1" shape as
-- app_settings — one Spotify account per app, no user_id needed.
--
-- Deliberately different security model from every other table in this
-- app, app_settings included. app_settings only needs "must be logged
-- in" (phase5_auth_lockdown.sql) because there's nothing in it a logged
-- -in user shouldn't see. This table is different: it holds a live
-- OAuth refresh token, and the integration design doc is explicit that
-- "access and refresh tokens must remain server-side and must never be
-- exposed to the client" — including the client code the app's own
-- logged-in user runs in their browser, not just outside attackers.
--
-- So: RLS is enabled with NO policies at all for anon or authenticated.
-- That's a deny-all by default in Postgres — the browser's Supabase
-- client (and the normal cookie-session server client every other route
-- uses) get zero rows back, full stop. The only way in is
-- lib/supabase/service.ts's createServiceClient(), which uses the
-- service_role key and bypasses RLS entirely — the same pattern already
-- established for the cron notification job. Every Spotify route in
-- this feature reads/writes this table exclusively through that client.
create table if not exists spotify_tokens (
  id int primary key default 1,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint spotify_tokens_singleton check (id = 1)
);

alter table spotify_tokens enable row level security;

-- Explicit, even though a fresh table defaults to no access for these
-- roles anyway — future-proofs against someone later copy-pasting an
-- "allow all" grant from another migration onto this file without
-- reading the comment above first.
revoke all on public.spotify_tokens from anon, authenticated;