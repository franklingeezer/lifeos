import { NextResponse } from "next/server";
import { disconnectSpotify } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectSpotify();
  return NextResponse.json({ ok: true });
}