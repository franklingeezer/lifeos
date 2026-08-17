"use client";

import { useCallback, useEffect, useState } from "react";

export type PushStatus = "unsupported" | "checking" | "denied" | "subscribed" | "unsubscribed";

// Web Push requires the VAPID public key as a Uint8Array, but browsers
// only let you copy/paste it around as a base64url string — this is the
// standard conversion every Web Push tutorial reaches for.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// Some networks/firewalls silently block the browser's push service
// handshake (Google FCM for Chrome) rather than rejecting it outright —
// pushManager.subscribe() then just never resolves. Race it against a
// timeout so the UI can say something useful instead of spinning forever.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/**
 * Drives the Settings page's push-notification toggle. Talks to three
 * things: the browser's Notification permission, the service worker's
 * PushManager (see public/sw.js), and app/api/push/subscribe (which
 * persists/removes the subscription so the cron route in Part 3 can
 * actually find it).
 */
export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    setWorking(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");

      const registration = await navigator.serviceWorker.ready;
      const subscription = await withTimeout(
        registration.pushManager.subscribe({
          userVisibleOnly: true, // required by Chrome — every push must show a notification
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }),
        15000,
        "Timed out talking to the browser's push service. This usually means a firewall/VPN/network is blocking it, or the VAPID key is malformed — check NEXT_PUBLIC_VAPID_PUBLIC_KEY."
      );

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Server rejected the subscription.");

      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't enable push notifications.");
    } finally {
      setWorking(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setWorking(true);
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
      setStatus("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disable push notifications.");
    } finally {
      setWorking(false);
    }
  }, []);

  return { status, working, error, subscribe, unsubscribe };
}