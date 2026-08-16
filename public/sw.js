// LifeOS service worker — Part 1 (installability + offline app shell).
//
// Scope is deliberately narrow: this caches the app SHELL (static JS/CSS
// chunks, icons, the manifest, the offline fallback page) so the app is
// installable and doesn't show a browser error screen when you're offline.
// It does NOT cache Supabase API responses or your actual data — LifeOS's
// data is per-request and RLS-scoped, and silently serving stale/cached
// personal data from a service worker cache is the wrong default for an
// app like this. Real offline data support (if ever wanted) is a separate,
// deliberate feature, not a side effect of installability.
//
// Bump CACHE_VERSION whenever this file's caching strategy changes, so old
// clients clean up their stale cache on next activate.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `lifeos-shell-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

// Precached on install. Kept intentionally tiny — just enough that the
// offline fallback itself works with zero network, plus the icons it
// references. Next.js's hashed /_next/static/* chunks are NOT precached
// here since their filenames change on every build; they're picked up
// opportunistically by the fetch handler below instead (cache-as-you-go).
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Activate this SW as soon as it finishes installing, instead of
      // waiting for every open tab to close first — fine for a
      // single-user app where you'd rather just get the update.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never intercept writes

  const url = new URL(request.url);

  // Page navigations: network-first (you want fresh data/auth state when
  // online), falling back to the cached page or the offline screen when
  // the network fails entirely.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(request)) || (await cache.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Static, hashed build assets and icons: cache-first, since a hashed
  // filename never changes content — safe to serve straight from cache
  // and only hit the network the first time.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Everything else (Supabase reads/writes, /api/* AI routes, auth) is
  // intentionally left alone — no respondWith means it goes straight to
  // the network exactly as if there were no service worker at all.
});

// --- Web Push (Part 2) ---
//
// The server (Part 3, app/api/push/send or a cron route) sends a payload
// shaped like { title, body, url, tag }. `tag` is optional — when set,
// a second push with the same tag replaces the still-visible notification
// instead of stacking a duplicate (useful for something like "3 tasks
// overdue" ticking up rather than piling up separate banners).
self.addEventListener("push", (event) => {
  let payload = { title: "LifeOS", body: "You have a new notification.", url: "/", tag: undefined };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push payload (shouldn't happen from our own server) — fall
    // back to the defaults above rather than throwing.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

// Focuses an already-open LifeOS tab if one exists (rather than opening a
// duplicate), navigating it to the notification's target — otherwise opens
// a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});