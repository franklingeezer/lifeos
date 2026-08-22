import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico
     * - image/font/svg files
     * - sw.js, manifest.webmanifest — browsers require a service worker's
     *   own script fetch, and the manifest fetch, to never be redirected
     *   (a hard spec requirement, not just a preference). Before this
     *   exclusion, any unauthenticated request for either — which is
     *   exactly what happens on first load before login — got redirected
     *   to /login, and the browser silently refused to install the
     *   service worker at all as a result.
     * Everything else (including API routes) goes through the session check,
     * which is what we want — the AI routes read from Supabase too.
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};