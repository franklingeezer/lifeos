"use client";

import useSWR from "swr";

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

// Exported so SettingsPage can `mutate(LASTFM_NOW_PLAYING_KEY)` the instant
// the username changes, without waiting for the poll interval.
export const LASTFM_NOW_PLAYING_KEY = "/api/lastfm/now-playing";

async function fetchNowPlaying(): Promise<LastfmNowPlayingData> {
  const res = await fetch(LASTFM_NOW_PLAYING_KEY);
  if (!res.ok) throw new Error("Failed to load Last.fm now playing");
  return res.json();
}

/**
 * Polls every 30s — this is live-ish data (a scrobble can start or end at
 * any moment), same cadence useSpotifyNowPlaying used.
 */
export function useLastfmNowPlaying() {
  const { data, error, isLoading } = useSWR<LastfmNowPlayingData>(LASTFM_NOW_PLAYING_KEY, fetchNowPlaying, {
    refreshInterval: 30 * 1000,
  });
  return { data, error, isLoading };
}