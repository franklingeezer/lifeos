import { NextResponse } from "next/server";
import { isSpotifyConnected } from "@/lib/spotify";

export const dynamic = "force-dynamic";

// Deliberately its own tiny endpoint rather than folding this into
// now-playing's response — Settings needs to know "connected or not" the
// instant the page loads, without also needing to interpret playback
// state, and without the Dashboard's now-playing poll interval being the
// thing that decides how fresh the Settings toggle looks.
export async function GET() {
  return NextResponse.json({ connected: await isSpotifyConnected() });
}