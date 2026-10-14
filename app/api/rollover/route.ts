import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import { planRollover } from "@/lib/rollover";

export const dynamic = "force-dynamic";

/**
 * LifeOS Roadmap — Plan My Day, Part 2b.
 *
 * Returns calendar blocks that were set aside for a task but went by with
 * the task unfinished, each with a proposed new slot (or a reason there
 * isn't one). See lib/rollover.ts for exactly what counts as "missed".
 *
 * No AI call and no rate-limit check — pure calendar arithmetic, same as
 * /api/schedule-task and /api/plan-day. Read-only: it only proposes.
 * Rescheduling or dropping a block is a plain event update/delete the
 * frontend does itself, scoped to the caller by RLS.
 */
export async function GET() {
  const supabase = createClient();

  try {
    const plan = await planRollover(supabase);
    return NextResponse.json({ ...plan, today: todayISO() });
  } catch (err) {
    console.error("rollover: failed to build plan", err);
    return NextResponse.json({ error: "Couldn't check for missed blocks." }, { status: 500 });
  }
}