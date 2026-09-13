import { NextRequest, NextResponse } from "next/server";
import { storeSpotifyTokens } from "@/lib/spotify";

export const dynamic = "force-dynamic";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const STATE_COOKIE = "spotify_oauth_state";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error"); // e.g. "access_denied" if the user hit Cancel on Spotify's side
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  const settingsUrl = new URL("/settings", req.nextUrl.origin);

  if (oauthError) {
    settingsUrl.searchParams.set("spotify_error", oauthError);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("spotify_error", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  const redirectUri = `${req.nextUrl.origin}/api/spotify/callback`;
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });

  if (!tokenResponse.ok) {
    console.error("Spotify token exchange failed:", tokenResponse.status, await tokenResponse.text());
    settingsUrl.searchParams.set("spotify_error", "token_exchange_failed");
    return NextResponse.redirect(settingsUrl);
  }

  const tokens = await tokenResponse.json();
  await storeSpotifyTokens(tokens);

  settingsUrl.searchParams.set("spotify", "connected");
  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete(STATE_COOKIE);
  return response;
}