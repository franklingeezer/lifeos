"use client";

import { useCallback, useEffect, useState } from "react";

export type PushPermissionState = "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Push subscription keys arrive as URL-safe base64; the browser's
  // PushManager API wants a raw Uint8Array applicationServerKey, not a
  // string, so this conversion is required every time, not optional.
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Registers the service worker on mount (cheap and idempotent — the
 * browser no-ops if it's already registered and unchanged) and exposes
 * subscribe/unsubscribe for the actual push permission + subscription,
 * which stays a deliberate user action rather than something requested
 * automatically on page load.
 */
export function usePushSubscription() {
  const [permission, setPermission] = useState<PushPermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PushPermissionState);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setIsSubscribed(!!sub))
      .catch((err) => setError(err.message));
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");

      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PushPermissionState);
      if (permissionResult !== "granted") {
        throw new Error("Notification permission was not granted.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // required by Chrome: every push must show a visible notification
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          deviceLabel: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error("Failed to save subscription on the server.");

      setIsSubscribed(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setIsSubscribed(false);
    } catch (err: any) {
      setError(err.message ?? "Failed to unsubscribe.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { permission, isSubscribed, loading, error, subscribe, unsubscribe };
}