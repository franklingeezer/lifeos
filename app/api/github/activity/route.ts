import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO, toLocalISODate } from "@/lib/date";

export const dynamic = "force-dynamic";

const CARD_ITEM_LIMIT = 5;
const EVENT_LIMIT = 30;
const COMMIT_LIMIT = 20;

type GithubEvent = {
  id: string;
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: Record<string, unknown>;
};

type GithubCommitSearchResult = {
  sha: string;
  html_url: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  commit: {
    message: string;
    author?: {
      date?: string;
    };
    committer?: {
      date?: string;
    };
  };
};

type GithubCommitSearchResponse = {
  items?: GithubCommitSearchResult[];
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

function normalizeEvent(e: GithubEvent): GithubActivityItem | null {
  const repo = e.repo?.name ?? "unknown/repo";
  const repoUrl = `https://github.com/${repo}`;
  const isLifeOS = repo.toLowerCase().endsWith("/lifeos");

  const base = {
    id: e.id,
    repo,
    isLifeOS,
    createdAt: e.created_at,
  };

  switch (e.type) {
    case "PushEvent": {
      const payload = e.payload ?? {};
      const commits = Array.isArray(payload.commits)
        ? payload.commits
        : [];

      if (commits.length === 0) return null;

      const ref =
        typeof payload.ref === "string"
          ? payload.ref.replace("refs/heads/", "")
          : "main";

      return {
        ...base,
        label: `Pushed to ${repo}`,
        detail: `${commits.length} commit${commits.length === 1 ? "" : "s"}`,
        url: `${repoUrl}/commits/${ref}`,
      };
    }

    case "PullRequestEvent": {
      const payload = e.payload ?? {};
      const action =
        typeof payload.action === "string" ? payload.action : "";

      if (
        action !== "opened" &&
        action !== "closed" &&
        action !== "reopened"
      ) {
        return null;
      }

      const pr =
        typeof payload.pull_request === "object" &&
        payload.pull_request !== null
          ? (payload.pull_request as {
              merged?: boolean;
              title?: string;
              html_url?: string;
            })
          : null;

      const merged = action === "closed" && pr?.merged;

      const verb = merged
        ? "Merged"
        : action === "opened"
          ? "Opened"
          : action === "reopened"
            ? "Reopened"
            : "Closed";

      return {
        ...base,
        label: `${verb} PR in ${repo}`,
        detail: pr?.title ?? null,
        url: pr?.html_url ?? repoUrl,
      };
    }

    case "IssuesEvent": {
      const payload = e.payload ?? {};
      const action =
        typeof payload.action === "string" ? payload.action : "";

      if (
        action !== "opened" &&
        action !== "closed" &&
        action !== "reopened"
      ) {
        return null;
      }

      const issue =
        typeof payload.issue === "object" &&
        payload.issue !== null
          ? (payload.issue as {
              title?: string;
              html_url?: string;
            })
          : null;

      const verb =
        action === "opened"
          ? "Opened"
          : action === "reopened"
            ? "Reopened"
            : "Closed";

      return {
        ...base,
        label: `${verb} issue in ${repo}`,
        detail: issue?.title ?? null,
        url: issue?.html_url ?? repoUrl,
      };
    }

    case "ReleaseEvent": {
      const payload = e.payload ?? {};

      if (payload.action !== "published") return null;

      const release =
        typeof payload.release === "object" &&
        payload.release !== null
          ? (payload.release as {
              tag_name?: string;
              name?: string;
              html_url?: string;
            })
          : null;

      return {
        ...base,
        label: `Released ${release?.tag_name ?? ""} in ${repo}`.trim(),
        detail: release?.name ?? null,
        url: release?.html_url ?? repoUrl,
      };
    }

    case "CreateEvent": {
      const payload = e.payload ?? {};

      if (payload.ref_type !== "repository") return null;

      return {
        ...base,
        label: `Created repository ${repo}`,
        detail: null,
        url: repoUrl,
      };
    }

    default:
      return null;
  }
}

function normalizeCommit(
  commit: GithubCommitSearchResult,
): GithubActivityItem | null {
  const repo = commit.repository?.full_name;

  if (!repo) return null;

  const createdAt =
    commit.commit?.author?.date ??
    commit.commit?.committer?.date;

  if (!createdAt) return null;

  const message =
    commit.commit?.message?.split("\n")[0]?.trim() || null;

  return {
    id: `commit-${commit.sha}`,
    label: `Committed to ${repo}`,
    detail: message,
    repo,
    isLifeOS: repo.toLowerCase().endsWith("/lifeos"),
    url: commit.html_url ?? commit.repository.html_url,
    createdAt,
  };
}

export async function GET() {
  const supabase = createClient();

  const { data: settingsRow, error: settingsError } = await supabase
    .from("app_settings")
    .select("github_username")
    .eq("id", 1)
    .maybeSingle();

  if (settingsError) {
    return NextResponse.json({
      configured: false,
      error:
        "Couldn't read GitHub settings — has phase20_github_integration.sql been run yet?",
    });
  }

  const username = settingsRow?.github_username?.trim();

  if (!username) {
    return NextResponse.json({
      configured: false,
    });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lifeos-dashboard",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const token = process.env.GITHUB_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const activities: GithubActivityItem[] = [];

  /*
   * 1. Try GitHub's public events API.
   *
   * Useful for PRs, issues, releases and push events.
   * However, GitHub documents that this endpoint can have
   * significant latency, so it is not our only source.
   */
  try {
    const eventsResponse = await fetch(
      `https://api.github.com/users/${encodeURIComponent(
        username,
      )}/events/public?per_page=${EVENT_LIMIT}`,
      {
        headers,
        next: { revalidate: 120 },
      },
    );

    if (eventsResponse.ok) {
      const events = (await eventsResponse.json()) as GithubEvent[];

      activities.push(
        ...events
          .map(normalizeEvent)
          .filter(
            (item): item is GithubActivityItem => item !== null,
          ),
      );
    } else if (
      eventsResponse.status !== 404 &&
      eventsResponse.status !== 403
    ) {
      console.error(
        "GitHub events API error:",
        eventsResponse.status,
      );
    }
  } catch (error) {
    console.error("GitHub events fetch failed:", error);
  }

  /*
   * 2. Search commits authored by this GitHub username.
   *
   * This is the important fallback. It gives LifeOS a reliable
   * coding-activity signal even when the Events API has not yet
   * populated the user's event stream.
   */
  try {
    const query = encodeURIComponent(
      `author:${username}`,
    );

    const commitsResponse = await fetch(
      `https://api.github.com/search/commits?q=${query}&sort=committer-date&order=desc&per_page=${COMMIT_LIMIT}`,
      {
        headers: {
          ...headers,
          Accept: "application/vnd.github+json",
        },
        next: { revalidate: 120 },
      },
    );

    if (commitsResponse.ok) {
      const commitData =
        (await commitsResponse.json()) as GithubCommitSearchResponse;

      const commitActivities = (commitData.items ?? [])
        .map(normalizeCommit)
        .filter(
          (item): item is GithubActivityItem => item !== null,
        );

      activities.push(...commitActivities);
    } else {
      console.error(
        "GitHub commit search error:",
        commitsResponse.status,
      );
    }
  } catch (error) {
    console.error("GitHub commit search failed:", error);
  }

  /*
   * Remove duplicates and sort newest first.
   */
  const uniqueActivities = Array.from(
    new Map(
      activities.map((activity) => [activity.id, activity]),
    ).values(),
  ).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime(),
  );

  const today = todayISO();

  const todayCount = uniqueActivities.filter(
    (activity) =>
      toLocalISODate(new Date(activity.createdAt)) === today,
  ).length;

  return NextResponse.json({
    configured: true,
    username,
    profileUrl: `https://github.com/${username}`,
    todayCount,
    activities: uniqueActivities.slice(0, CARD_ITEM_LIMIT),
  });
}