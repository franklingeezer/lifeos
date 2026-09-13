import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Last.fm's stock "no artwork submitted" placeholder — a gray star icon
// served at this same image hash for every track that has none. Detected
// and treated as no image rather than showing that placeholder in the card.
const LASTFM_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export type LastfmTrack = {
  name: string;
  artist: string;
  albumArt: string | null;
  trackUrl: string;
};

export type LastfmNowPlayingData =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; playing: true; track: LastfmTrack }
  | { configured: true; playing: false; recentTrack: LastfmTrack | null; playedAt: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrack(raw: any): LastfmTrack | null {
  if (!raw) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const images: any[] = raw.image ?? [];
  const art = images.find((i) => i.size === "extralarge")?.["#text"] || images[images.length - 1]?.["#text"] || null;
  return {
    name: raw.name || "Unknown track",
    artist: raw.artist?.["#text"] || raw.artist?.name || "Unknown artist",
    albumArt: art && !art.includes(LASTFM_PLACEHOLDER_HASH) ? art : null,
    trackUrl: raw.url || "https://www.last.fm",
  };
}

export async function GET() {
  const supabase = createClient();

  const { data: settingsRow, error: settingsError } = await supabase
    .from("app_settings")
    .select("lastfm_username")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    // Most likely cause: phase22_lastfm_integration.sql hasn't been run
    // against this Supabase project yet.
    return NextResponse.json({
      configured: false,
      error: "Couldn't read Last.fm settings — has phase22_lastfm_integration.sql been run yet?",
    });
  }

  const username = settingsRow?.lastfm_username?.trim();
  if (!username) {
    return NextResponse.json({ configured: false });
  }

  if (!process.env.LASTFM_API_KEY) {
    return NextResponse.json({ configured: true, error: "LASTFM_API_KEY is not set. Add it to .env.local." });
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", process.env.LASTFM_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  let response: Response;
  try {
    // Last.fm's free tier is generous (a few requests/second) compared to
    // GitHub's — a short cache still avoids hammering it across a burst
    // of dev-server restarts, without staling out the "live" feel this
    // card is supposed to have.
    response = await fetch(url, { next: { revalidate: 15 } });
  } catch (err) {
    console.error("Last.fm fetch failed:", err);
    return NextResponse.json({ configured: true, error: "Couldn't reach Last.fm. Try again shortly." });
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || body?.error) {
    // error code 6 = "user not found" (Last.fm's own error taxonomy)
    const message = body?.error === 6 ? `Last.fm user "${username}" not found.` : "Last.fm API returned an unexpected error.";
    if (body?.error !== 6) console.error("Last.fm API error:", response.status, body);
    return NextResponse.json({ configured: true, error: message });
  }

  const raw = body?.recenttracks?.track?.[0];
  if (!raw) {
    return NextResponse.json({ configured: true, playing: false, recentTrack: null, playedAt: null });
  }

  const track = normalizeTrack(raw);
  const isNowPlaying = raw["@attr"]?.nowplaying === "true";

  if (isNowPlaying && track) {
    return NextResponse.json({ configured: true, playing: true, track });
  }

  const playedAtUnixSeconds = raw.date?.uts ? Number(raw.date.uts) : null;
  const playedAt = playedAtUnixSeconds ? new Date(playedAtUnixSeconds * 1000).toISOString() : null;
  return NextResponse.json({ configured: true, playing: false, recentTrack: track, playedAt });
}