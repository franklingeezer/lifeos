"use client";

import React from "react";
import Link from "next/link";
import { Github, GitCommit, GitPullRequest, CircleDot, Tag, FolderGit2, ArrowUpRight } from "lucide-react";
import { useGithubActivity, type GithubActivityItem } from "@/hooks/useGithubActivity";
import { timeAgo } from "@/lib/date";

function iconFor(item: GithubActivityItem) {
  if (item.label.startsWith("Pushed")) return GitCommit;
  if (item.label.includes("PR")) return GitPullRequest;
  if (item.label.includes("issue")) return CircleDot;
  if (item.label.startsWith("Released")) return Tag;
  if (item.label.startsWith("Created repository")) return FolderGit2;
  return Github;
}

export default function GithubActivityCard() {
  const { data, isLoading } = useGithubActivity();
  const hasProfileLink = !isLoading && data?.configured && "profileUrl" in data;

  return (
    <div
      className="lifeos-card"
      style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 16, padding: 18 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
          <Github size={14} color="rgb(var(--text-muted))" /> GitHub Activity
        </div>
        {hasProfileLink && (
          <a
            href={(data as { profileUrl: string }).profileUrl}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "rgb(var(--accent))", textDecoration: "none" }}
          >
            View activity <ArrowUpRight size={12} />
          </a>
        )}
      </div>

      {isLoading && <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>Loading GitHub activity…</div>}

      {!isLoading && data && !data.configured && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))", lineHeight: 1.5 }}>
          Not connected yet.{" "}
          <Link href="/settings" style={{ color: "rgb(var(--accent))" }}>
            Add your GitHub username in Settings
          </Link>{" "}
          to see your activity here.
        </div>
      )}

      {!isLoading && data && data.configured && "error" in data && (
        <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>{data.error}</div>
      )}

      {!isLoading && data && data.configured && "activities" in data && (
        <>
          <div className="font-mono" style={{ fontSize: 22, fontWeight: 500, marginBottom: 2 }}>
            {data.todayCount}
          </div>
          <div style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", marginBottom: 12 }}>
            {data.todayCount === 1 ? "activity" : "activities"} today
          </div>

          {data.activities.length === 0 && (
            <div style={{ fontSize: 12.5, color: "rgb(var(--text-muted))" }}>No recent public activity.</div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.activities.map((item) => {
              const Icon = iconFor(item);
              return (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, textDecoration: "none", color: "inherit" }}
                >
                  <Icon size={13} color="rgb(var(--text-muted))" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      {item.isLifeOS && (
                        <span
                          style={{
                            fontSize: 10, padding: "1px 6px", borderRadius: 99, flexShrink: 0,
                            background: "rgb(var(--surface-2))", color: "rgb(var(--accent))",
                          }}
                        >
                          LifeOS
                        </span>
                      )}
                    </div>
                    {item.detail && (
                      <div
                        style={{ fontSize: 11.5, color: "rgb(var(--text-muted))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {item.detail}
                      </div>
                    )}
                  </div>
                  <span className="font-mono" style={{ fontSize: 10.5, color: "rgb(var(--text-muted))", flexShrink: 0 }}>
                    {timeAgo(item.createdAt)}
                  </span>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}