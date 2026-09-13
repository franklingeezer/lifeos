"use client";

import useSWR from "swr";

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

export const SPOTIFY_NOW_PLAYING_KEY = "/api/spotify/now-playing";

async function fetchNowPlaying(): Promise<SpotifyNowPlayingData> {
  const res = await fetch(SPOTIFY_NOW_PLAYING_KEY);
  if (!res.ok) throw new Error("Failed to load Spotify now playing");
  return res.json();
}

/**
 * Polls every 30s — much more often than useGithubActivity's 5 minutes,
 * because "now playing" is live data. Settings calls
 * `mutate(SPOTIFY_NOW_PLAYING_KEY)` on connect/disconnect so this doesn't
 * wait a full 30s to reflect a state change the user just made.
 */
export function useSpotifyNowPlaying() {
  const { data, error, isLoading } = useSWR<SpotifyNowPlayingData>(SPOTIFY_NOW_PLAYING_KEY, fetchNowPlaying, {
    refreshInterval: 30 * 1000,
  });
  return { data, error, isLoading };
}