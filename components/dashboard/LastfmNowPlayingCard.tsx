"use client";

import React from "react";
import Link from "next/link";
import { Music2 } from "lucide-react";
import { useLastfmNowPlaying } from "@/hooks/useLastfmNowPlaying";
import { timeAgo } from "@/lib/date";

export default function LastfmNowPlayingCard() {
  const { data, isLoading } = useLastfmNowPlaying();

  const isPlaying = !isLoading && !!data?.configured && "playing" in data && data.playing;
  const track =
    !isLoading && data?.configured && "playing" in data ? (data.playing ? data.track : data.recentTrack) : null;
  const playedAt = !isLoading && data?.configured && "playing" in data && !data.playing ? data.playedAt : null;

  return (
    <div
      className="lifeos-card"
      style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        <Music2 size={14} color="rgb(var(--text-muted))" />
        {isPlaying ? "Now Playing" : "Last Played"}
      </div>

      {isLoading && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Loading Last.fm…</div>}

      {!isLoading && data && !data.configured && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", lineHeight: 1.5 }}>
          Not connected yet.{" "}
          <Link href="/settings" style={{ color: "rgb(var(--accent))" }}>
            Add your Last.fm username in Settings
          </Link>
          .
        </div>
      )}

      {!isLoading && data && data.configured && "error" in data && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>{data.error}</div>
      )}

      {!isLoading && data && data.configured && "playing" in data && !track && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Nothing scrobbled yet.</div>
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
            {!isPlaying && playedAt && (
              <div className="font-mono" style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", marginTop: 2 }}>
                {timeAgo(playedAt)}
              </div>
            )}
          </div>
        </a>
      )}
    </div>
  );
}