import { createServiceClient } from "@/lib/supabase/service";

// Server-only. Never import this from a "use client" file — every function
// here goes through createServiceClient(), which uses the service_role key
// and must never reach the browser bundle. Route handlers are the correct
// (and only) callers.

const TOKEN_URL = "https://accounts.spotify.com/api/token";
// Refresh a minute early rather than waiting for the exact expiry second —
// avoids a race where a request starts with a token that's valid at read
// time but expires mid-flight to Spotify's API.
const REFRESH_BUFFER_MS = 60_000;

type StoredTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO
};

type RefreshedTokens = {
  access_token: string;
  refresh_token?: string; // Spotify doesn't always rotate it on refresh
  expires_in: number;
  scope?: string;
};

function basicAuthHeader(): string {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function isSpotifyConnected(): Promise<boolean> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("spotify_tokens").select("id").eq("id", 1).maybeSingle();
  return !!data;
}

export async function disconnectSpotify(): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("spotify_tokens").delete().eq("id", 1);
}

export async function storeSpotifyTokens(tokens: RefreshedTokens & { refresh_token: string }): Promise<void> {
  const supabase = createServiceClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await supabase.from("spotify_tokens").upsert(
    {
      id: 1,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

/**
 * Returns a valid access token, refreshing it first if it's expired or
 * about to be — callers never think about the refresh dance themselves.
 *
 * Returns null if Spotify was never connected, OR if the refresh token
 * itself is dead (Spotify's `invalid_grant`, e.g. the user revoked
 * LifeOS's access from their Spotify account settings) — in that case
 * the stored row is cleared so the UI correctly falls back to a
 * "reconnect" prompt instead of retrying a token that will never work
 * again.
 */
export async function getSpotifyAccessToken(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("spotify_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  if (!data) return null;
  const tokens = data as StoredTokens;

  const expiresAtMs = new Date(tokens.expires_at).getTime();
  if (expiresAtMs - REFRESH_BUFFER_MS > Date.now()) {
    return tokens.access_token; // still valid, no refresh needed
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuthHeader() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Spotify token refresh failed:", response.status, body);
    if (response.status === 400) {
      // invalid_grant — the refresh token itself is dead, not just expired.
      // Retrying later won't help; clear it so the card shows "reconnect."
      await disconnectSpotify();
    }
    return null;
  }

  const refreshed = (await response.json()) as RefreshedTokens;
  await storeSpotifyTokens({ ...refreshed, refresh_token: refreshed.refresh_token ?? tokens.refresh_token });

  return refreshed.access_token;
}