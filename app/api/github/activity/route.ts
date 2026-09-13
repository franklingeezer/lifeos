import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO, toLocalISODate } from "@/lib/date";

export const dynamic = "force-dynamic";

// GitHub's public Events API only ever returns roughly the last 90 days
// (or the most recent 300 events, whichever is smaller) — plenty for a
// "recent activity" dashboard card, not a real history view, which isn't
// what this card is for anyway. We only look at the newest slice of that.
const GITHUB_EVENTS_LIMIT = 30;
const CARD_ITEM_LIMIT = 5;

type GithubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  // GitHub's payload shape differs per event type and isn't worth typing
  // in full for five fields we actually read — see normalizeEvent.
  payload: Record<string, any>;
};

export type GithubActivityItem = {
  id: string;
  label: string;
  detail: string | null;
  repo: string;
  isLifeOS: boolean;
  url: string;
  createdAt: string;
};

// Only the event types the integration spec calls out as useful (pushes,
// PRs, issues, releases, repo creation) turn into a card line — stars,
// forks, watches, wiki edits, etc. are noise for "what did I actually do
// today" and are silently dropped.
function normalizeEvent(e: GithubEvent): GithubActivityItem | null {
  const repo = e.repo?.name ?? "unknown/repo";
  const repoUrl = `https://github.com/${repo}`;
  const isLifeOS = repo.toLowerCase().endsWith("/lifeos");
  const base = { id: e.id, repo, isLifeOS, createdAt: e.created_at };

  switch (e.type) {
    case "PushEvent": {
      const commitCount = e.payload?.commits?.length ?? 0;
      if (commitCount === 0) return null; // e.g. a branch delete shows up as an empty push
      const branch = (e.payload?.ref as string | undefined)?.replace("refs/heads/", "") ?? "main";
      return {
        ...base,
        label: `Pushed to ${repo}`,
        detail: `${commitCount} commit${commitCount === 1 ? "" : "s"}`,
        url: `${repoUrl}/commits/${branch}`,
      };
    }
    case "PullRequestEvent": {
      const action = e.payload?.action as string | undefined;
      if (action !== "opened" && action !== "closed" && action !== "reopened") return null;
      const pr = e.payload?.pull_request;
      const merged = action === "closed" && pr?.merged;
      const verb = merged ? "Merged" : action === "opened" ? "Opened" : action === "reopened" ? "Reopened" : "Closed";
      return { ...base, label: `${verb} PR in ${repo}`, detail: pr?.title ?? null, url: pr?.html_url ?? repoUrl };
    }
    case "IssuesEvent": {
      const action = e.payload?.action as string | undefined;
      if (action !== "opened" && action !== "closed" && action !== "reopened") return null;
      const issue = e.payload?.issue;
      const verb = action === "opened" ? "Opened" : action === "reopened" ? "Reopened" : "Closed";
      return { ...base, label: `${verb} issue in ${repo}`, detail: issue?.title ?? null, url: issue?.html_url ?? repoUrl };
    }
    case "ReleaseEvent": {
      if (e.payload?.action !== "published") return null;
      const release = e.payload?.release;
      return {
        ...base,
        label: `Released ${release?.tag_name ?? ""} in ${repo}`.trim(),
        detail: release?.name ?? null,
        url: release?.html_url ?? repoUrl,
      };
    }
    case "CreateEvent": {
      if (e.payload?.ref_type !== "repository") return null; // branch/tag creation is too noisy for this card
      return { ...base, label: `Created repository ${repo}`, detail: null, url: repoUrl };
    }
    default:
      return null;
  }
}

/**
 * Always returns 200 with a `configured`/`error` shape rather than a 4xx —
 * same "the feature degrades, it doesn't crash the page" philosophy as
 * Inbox's AI classification and the AI Assistant's rate limiter failing
 * open. The Dashboard card is the thing responsible for turning these
 * states into a connect prompt, an error line, or the real card.
 */
export async function GET() {
  const supabase = createClient();

  const { data: settingsRow, error: settingsError } = await supabase
    .from("app_settings")
    .select("github_username")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    // Most likely cause: phase20_github_integration.sql hasn't been run
    // against this Supabase project yet, so the column genuinely doesn't
    // exist yet. Say so plainly instead of a generic failure.
    return NextResponse.json({
      configured: false,
      error: "Couldn't read GitHub settings — has phase20_github_integration.sql been run yet?",
    });
  }

  const username = settingsRow?.github_username?.trim();
  if (!username) {
    return NextResponse.json({ configured: false });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lifeos-dashboard", // GitHub's REST API rejects requests with no User-Agent
  };
  // Optional — the card works fine unauthenticated (60 requests/hour per
  // IP is plenty for one person's dashboard, especially cached below), but
  // a token raises that to 5,000/hour if it's ever needed. Same
  // "works fully without it" pattern as Web Push's VAPID keys.
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public`, {
      headers,
      // Next's Data Cache, not an in-memory Map — shared across
      // serverless instances the way a plain Map isn't (see
      // ai-rate-limit.ts's comment on exactly this pitfall), so a burst
      // of dashboard loads from different Vercel instances still only
      // hits GitHub once every two minutes, not once per request.
      next: { revalidate: 120 },
    });
  } catch (err) {
    console.error("GitHub activity fetch failed:", err);
    return NextResponse.json({ configured: true, username, error: "Couldn't reach GitHub. Try again shortly." });
  }

  if (response.status === 404) {
    return NextResponse.json({ configured: true, username, error: `GitHub user "${username}" not found.` });
  }
  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const message = remaining === "0" ? "GitHub API rate limit hit — try again in a few minutes." : "GitHub API refused the request.";
    return NextResponse.json({ configured: true, username, error: message });
  }
  if (!response.ok) {
    console.error("GitHub API error:", response.status, await response.text());
    return NextResponse.json({ configured: true, username, error: "GitHub API returned an unexpected error." });
  }

  const events = (await response.json()) as GithubEvent[];
  const activities = events
    .slice(0, GITHUB_EVENTS_LIMIT)
    .map(normalizeEvent)
    .filter((a): a is GithubActivityItem => a !== null);

  const today = todayISO();
  const todayCount = activities.filter((a) => toLocalISODate(new Date(a.createdAt)) === today).length;

  return NextResponse.json({
    configured: true,
    username,
    profileUrl: `https://github.com/${username}`,
    todayCount,
    activities: activities.slice(0, CARD_ITEM_LIMIT),
  });
}