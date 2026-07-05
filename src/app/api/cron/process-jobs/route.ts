import { NextRequest, NextResponse } from "next/server";
import { processPendingJobs } from "@/lib/invoice";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (secret && authHeader !== `Bearer ${secret}`) {
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const processed = await processPendingJobs(20);
    return NextResponse.json({
      success: true,
      processed,
      message: `Processed ${processed} invoice jobs`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Cron] process-jobs failed:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
