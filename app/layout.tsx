import type { Metadata } from "next";
import { Inter, Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "LifeOS",
  description: "Personal operating system.",
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
        {children}
      </body>
    </html>
  );
}