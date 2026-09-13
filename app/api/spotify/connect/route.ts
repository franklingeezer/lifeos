import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

// user-read-recently-played covers the "nothing playing right now" fallback
// from the integration doc; the other two cover the live Now Playing state.
const SCOPES = "user-read-currently-playing user-read-playback-state user-read-recently-played";
const STATE_COOKIE = "spotify_oauth_state";

export async function GET(req: NextRequest) {
  if (!process.env.SPOTIFY_CLIENT_ID) {
    return NextResponse.json({ error: "SPOTIFY_CLIENT_ID is not set. Add it to .env.local first." }, { status: 500 });
  }

  // Not a session of any kind — just proves the browser that lands on
  // /api/spotify/callback is the same one that started this request,
  // so a crafted callback URL can't plant someone else's tokens here.
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/spotify/callback`;

  const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", process.env.SPOTIFY_CLIENT_ID);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes — plenty of time to approve on Spotify's side, short enough to not linger
    path: "/",
  });
  return response;
}