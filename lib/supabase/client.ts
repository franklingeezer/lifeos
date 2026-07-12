import { createBrowserClient } from "@supabase/ssr";

// Client-side Supabase instance. Safe to use in "use client" components.
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a public-facing key (like the old
// anon key) — it's fine that it ends up in the browser bundle. Never put a
// service role / secret key behind a NEXT_PUBLIC_ prefix.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
