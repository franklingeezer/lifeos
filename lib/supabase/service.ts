import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses Row Level Security entirely. ONLY ever
// import this from server-only code that never runs in the browser (cron
// routes), and never from anything reachable with a plain GET from a
// browser without the CRON_SECRET check in front of it (see
// app/api/cron/notifications/route.ts). This is the one place in LifeOS
// that deliberately steps around the auth.uid() = user_id policies that
// protect every other table access — a cron job has no logged-in session
// to scope to, so it has to authenticate a different way (the secret
// header) and then act on behalf of the app's one user explicitly.
//
// SUPABASE_SERVICE_ROLE_KEY is NOT the same key as
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — grab it from Supabase dashboard
// → Project Settings → API → service_role (the "secret" one, not
// "anon"/"publishable"). Never prefix it with NEXT_PUBLIC_.
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}