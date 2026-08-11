import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's password-reset email links here with `?code=...` (PKCE flow,
// since @supabase/ssr uses PKCE by default). Exchanging that code for a
// session is what actually logs the browser in — briefly, in a special
// "recovery" state — so the next page (reset-password) can call
// supabase.auth.updateUser({ password }) without needing the old password.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // No code, or the exchange failed (expired/already-used link, etc.) —
  // send them back to forgot-password with a flag the page can use to
  // show a "that link didn't work, try again" message.
  return NextResponse.redirect(`${origin}/forgot-password?error=link_expired`);
}