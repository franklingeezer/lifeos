"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { useSpotifyNowPlaying, type NowPlayingTrack } from "@/hooks/useSpotifyNowPlaying";

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function SpotifyNowPlayingCard() {
  const { data, isLoading } = useSpotifyNowPlaying();

  const isPlaying = !isLoading && !!data?.configured && "playing" in data && data.playing;
  const track: NowPlayingTrack | null =
    !isLoading && data?.configured && "playing" in data ? (data.playing ? data.track : data.recentTrack) : null;

  // The API only gives a progress snapshot at poll time (every 30s) — this
  // local ticker advances the bar every second in between polls instead of
  // it visibly jumping once every 30 seconds. Re-syncs whenever a fresh
  // snapshot arrives (new track, corrected progress, or playback resumed).
  const [localProgress, setLocalProgress] = useState(0);
  useEffect(() => {
    if (!isPlaying || !track) return;
    setLocalProgress(track.progressMs);
    const t = setInterval(() => {
      setLocalProgress((p) => Math.min(p + 1000, track.durationMs));
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying, track?.trackUrl, track?.progressMs, track?.durationMs]);

  return (
    <div
      className="lifeos-card"
      style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        <Music2 size={14} color="rgb(var(--text-muted))" />
        {isPlaying ? "Now Playing" : "Recently Played"}
      </div>

      {isLoading && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Loading Spotify…</div>}

      {!isLoading && data && !data.configured && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", lineHeight: 1.5 }}>
          Not connected yet.{" "}
          <Link href="/settings" style={{ color: "rgb(var(--accent))" }}>
            Connect Spotify in Settings
          </Link>
          .
        </div>
      )}

      {!isLoading && data && data.configured && "error" in data && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>{data.error}</div>
      )}

      {!isLoading && data && data.configured && "playing" in data && !track && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Nothing played recently.</div>
      )}

      {track && (
        <a
          href={track.trackUrl}
          target="_blank"
          rel="noreferrer"
          style={{ display: "flex", gap: 12, textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              width: 56, height: 56, borderRadius: 8, flexShrink: 0, overflow: "hidden",
              background: "rgb(var(--surface-2))", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {track.albumArt ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.albumArt} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <Music2 size={20} color="rgb(var(--text-muted))" />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {track.name}
            </div>
            <div style={{ fontSize: 12, color: "rgb(var(--text-muted))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {track.artist}
            </div>
            {isPlaying && track.durationMs > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 99, background: "rgb(var(--surface-2))", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min((localProgress / track.durationMs) * 100, 100)}%`,
                      height: "100%", background: "rgb(var(--accent))", borderRadius: 99,
                    }}
                  />
                </div>
                <span className="font-mono" style={{ fontSize: 10, color: "rgb(var(--text-muted))", flexShrink: 0 }}>
                  {formatMs(localProgress)} / {formatMs(track.durationMs)}
                </span>
              </div>
            )}
          </div>
        </a>
      )}
    </div>
  );
}