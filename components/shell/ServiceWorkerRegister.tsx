"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js on mount. Renders nothing — this is a side-effect
 * component, mounted once from Providers.
 *
 * Gated to production only: in `next dev`, the dev server's own hot-reload
 * cache-busting fights with a service worker intercepting navigations, and
 * you'd end up debugging stale-chunk ghosts instead of your actual code.
 * The real thing only matters once this is actually deployed anyway.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}