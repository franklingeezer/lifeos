import { NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export type NowPlayingTrack = {
  name: string;
  artist: string;
  albumArt: string | null;
  progressMs: number;
  durationMs: number;
  trackUrl: string;
};

export type SpotifyNowPlayingData =
  | { configured: false }
  | { configured: true; error: string }
  | { configured: true; playing: true; track: NowPlayingTrack }
  | { configured: true; playing: false; recentTrack: NowPlayingTrack | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTrack(item: any): NowPlayingTrack | null {
  if (!item) return null;
  return {
    name: item.name ?? "Unknown track",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    artist: (item.artists ?? []).map((a: any) => a.name).join(", "),
    albumArt: item.album?.images?.[1]?.url ?? item.album?.images?.[0]?.url ?? null,
    progressMs: 0,
    durationMs: item.duration_ms ?? 0,
    trackUrl: item.external_urls?.spotify ?? "https://open.spotify.com",
  };
}

export async function GET() {
  const accessToken = await getSpotifyAccessToken();
  if (!accessToken) {
    return NextResponse.json({ configured: false });
  }

  const headers = { Authorization: `Bearer ${accessToken}` };

  const currentRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", { headers, cache: "no-store" });

  // 204 = authenticated fine, just nothing playing — not an error, falls
  // through to the recently-played lookup below.
  if (currentRes.status === 200) {
    const current = await currentRes.json();
    if (current?.is_playing && current?.item) {
      const track = normalizeTrack(current.item);
      if (track) {
        track.progressMs = current.progress_ms ?? 0;
        return NextResponse.json({ configured: true, playing: true, track });
      }
    }
    // is_playing: false (paused) also falls through intentionally —
    // "paused" reads as "not actively playing" for this card, same as
    // nothing queued at all.
  } else if (currentRes.status !== 204 && !currentRes.ok) {
    console.error("Spotify currently-playing error:", currentRes.status, await currentRes.text());
    return NextResponse.json({ configured: true, error: "Couldn't reach Spotify. Try again shortly." });
  }

  const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers, cache: "no-store" });
  if (!recentRes.ok) {
    console.error("Spotify recently-played error:", recentRes.status, await recentRes.text());
    return NextResponse.json({ configured: true, playing: false, recentTrack: null });
  }

  const recent = await recentRes.json();
  const recentTrack = normalizeTrack(recent?.items?.[0]?.track);
  return NextResponse.json({ configured: true, playing: false, recentTrack });
}