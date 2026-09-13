/**
 * Fallback data source for the GitHub Activity dashboard card.
 *
 * The REST Events API (`/users/:username/events/public`, used by
 * app/api/github/activity/route.ts as the primary source) has a known,
 * observed gap for at least some accounts: it can return a clean 200 with
 * zero events even when real, recent activity clearly exists — confirmed
 * by comparing it directly against this same account's contribution graph
 * and this Atom feed, which both showed a push the REST API didn't.
 *
 * GitHub's public Atom timeline (`github.com/:username.atom`) isn't part
 * of the documented REST/GraphQL API — it's the feed powering the
 * "Subscribe to atom feed" link on a profile page, and its shape isn't
 * guaranteed to stay stable. That's exactly why this is a *fallback*,
 * not the primary source: prefer the officially documented API whenever
 * it actually has data, and only reach for this when it doesn't.
 *
 * Deliberately narrow in scope: only PushEvents are parsed. The feed's
 * entry `id` encodes an event type prefix (confirmed: "push"; commonly
 * documented elsewhere for pull requests, issues, etc., but not verified
 * firsthand here), and guessing at unverified formats risks silently
 * mis-parsing rather than just skipping — the same "drop what we're not
 * confident about" rule route.ts's own normalizeEvent already follows
 * for REST event types it doesn't recognize.
 */

export type GithubActivityItem = {
  id: string;
  label: string;
  detail: string | null;
  repo: string;
  isLifeOS: boolean;
  url: string;
  createdAt: string;
};

function extractEntries(xml: string): string[] {
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  const entries: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) entries.push(m[1]);
  return entries;
}

function firstMatch(block: string, re: RegExp): string | null {
  const m = block.match(re);
  return m ? m[1] : null;
}

export function parseGithubAtomFeed(xml: string): GithubActivityItem[] {
  const items: GithubActivityItem[] = [];

  for (const entry of extractEntries(xml)) {
    const pushId = firstMatch(entry, /tag:github\.com,\d+:push\/(\d+)/);
    if (!pushId) continue; // not a push entry (or an unrecognized id shape) — skip rather than guess

    const published = firstMatch(entry, /<published>([^<]+)<\/published>/);
    const href = firstMatch(entry, /<link type="text\/html" rel="alternate" href="([^"]+)"\s*\/>/);
    if (!published || !href) continue; // malformed relative to every real entry observed — skip defensively

    // The feed's timestamp format ("2026-09-13 12:44:37 UTC") happens to
    // parse correctly via `new Date(...)` in Node/V8, but that's parser
    // leniency, not a spec guarantee — normalizing it explicitly to
    // strict ISO-8601 here means every downstream consumer (route.ts's
    // toLocalISODate, GithubActivityCard's timeAgo) gets the exact same
    // shape regardless of which source (REST or this fallback) produced
    // the item, rather than two subtly different "kinds" of date string
    // floating around.
    const isoMatch = published.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/);
    const createdAt = isoMatch ? `${isoMatch[1]}T${isoMatch[2]}Z` : published;

    const repoMatch = href.match(/github\.com\/([^\/]+\/[^\/]+)\/compare\//);
    const repo = repoMatch ? repoMatch[1] : null;
    if (!repo) continue;

    const branchMatch = entry.match(/branch-name[^>]*>([^<]+)</);
    const branch = branchMatch ? branchMatch[1] : "main";

    items.push({
      id: `atom-push-${pushId}`,
      label: `Pushed to ${repo}`,
      detail: null, // commit count lives in the feed's deeply-nested internal HTML, which is even less stable than the outer entry shape — not worth the fragility to extract
      repo,
      isLifeOS: repo.toLowerCase().endsWith("/lifeos"),
      url: `https://github.com/${repo}/commits/${branch}`,
      createdAt,
    });
  }

  return items;
}

/**
 * Fetches and parses the Atom fallback. Never throws — any failure
 * (network, unexpected format) just yields an empty array, so a caller
 * can always safely fall back further to "no activity" without extra
 * try/catch of its own.
 */
export async function fetchGithubAtomActivity(username: string): Promise<GithubActivityItem[]> {
  try {
    const res = await fetch(`https://github.com/${encodeURIComponent(username)}.atom`, {
      next: { revalidate: 120 }, // same cache window as the REST path in route.ts
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseGithubAtomFeed(xml);
  } catch (err) {
    console.error("GitHub Atom fallback fetch failed:", err);
    return [];
  }
}