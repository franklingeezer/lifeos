import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Called from the client right after `pushManager.subscribe()` succeeds
// (see the Settings toggle in Part 4). Upserts on `endpoint` so
// re-subscribing the same browser (permission re-granted, SW updated)
// updates the existing row instead of creating a duplicate that would
// get double-notified later.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as SubscriptionPayload;

  if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
    return NextResponse.json({ error: "Malformed subscription payload." }, { status: 400 });
  }

  const supabase = createClient();
  const userAgent = req.headers.get("user-agent");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Called when the user turns push off (or unregisters the SW) so a dead
// endpoint doesn't sit around forever and eat into delivery attempts.
export async function DELETE(req: NextRequest) {
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  const supabase = createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}