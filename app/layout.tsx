import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Personal operating system.",
  manifest: "/manifest.webmanifest",
  // iOS ignores the web manifest's icons entirely — Safari only looks at
  // this apple-touch-icon link, so it has to be declared separately.
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // iOS-only tags: enables standalone (no Safari chrome) launch from the
  // home screen, and sets the status bar style. "default" here (rather
  // than "black-translucent") keeps the status bar text readable against
  // this app's dark theme without extra safe-area padding work.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LifeOS",
  },
  // Next's `appleWebApp` option only emits the legacy
  // apple-mobile-web-app-capable tag. Chrome/Android now wants the
  // standard (non-prefixed) version too, and warns in the console
  // without it — both tags are needed side by side for full coverage.
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0D10",
  width: "device-width",
  initialScale: 1,
  // Prevents accidental pinch-zoom from breaking the standalone app feel
  // once installed — the desktop/browser tab experience is unaffected.
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies saved theme before paint, avoiding a flash of the wrong theme.
            Dark is the default (see globals.css :root); this only adds .light when needed. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('lifeos-theme');
                if (t === 'light') document.documentElement.classList.add('light');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} ${plexMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}