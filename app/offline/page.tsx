import { WifiOff } from "lucide-react";

// Served by the service worker (see public/sw.js) whenever a navigation
// request fails with no network and there's nothing more specific already
// cached. Deliberately static — no Supabase calls, no client state — so it
// works with zero connectivity and zero JS execution risk.
export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        gap: "12px",
      }}
    >
      <WifiOff size={40} style={{ color: "rgb(var(--text-muted))" }} />
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "rgb(var(--text))" }}>You're offline</h1>
      <p style={{ color: "rgb(var(--text-muted))", maxWidth: 320 }}>
        LifeOS needs a connection to reach your data. Reconnect and reload — anything you already had open should
        come back where you left it.
      </p>
    </main>
  );
}