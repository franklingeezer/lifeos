import type { MetadataRoute } from "next";

// Next.js App Router picks this up automatically and serves it at
// /manifest.webmanifest — no manual <link rel="manifest"> needed.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS",
    short_name: "LifeOS",
    description: "Personal operating system — tasks, habits, journal, finance, and more in one connected workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0D10", // matches --bg dark theme, avoids a white flash on launch
    theme_color: "#0B0D10",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}