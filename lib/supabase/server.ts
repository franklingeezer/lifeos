import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase instance, for Server Components / Route Handlers /
// Server Actions. Not needed yet while auth is skipped, but wired up so
// adding Supabase Auth later is a drop-in rather than a rewrite.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without a mutable cookie store —
            // safe to ignore if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
