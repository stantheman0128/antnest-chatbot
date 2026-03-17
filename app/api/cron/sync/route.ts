import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/data-service";

// Allow up to 60s on Vercel Pro; free plan caps at 10s but scrape is fire-and-forget
export const maxDuration = 60;

/**
 * GET /api/cron/sync
 * Called by Vercel Cron every Monday at 12:05 UTC (= 20:05 Taiwan time).
 * Vercel automatically sends: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if auto-sync is enabled in admin config
  try {
    const enabled = await getConfig("auto_sync_enabled");
    if (enabled === "false") {
      console.log("[Cron] Auto-sync disabled by admin config, skipping.");
      return NextResponse.json({ skipped: true, reason: "disabled" });
    }
  } catch {
    // If config check fails, proceed with sync anyway
  }

  // Determine app URL for internal API call
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  try {
    const res = await fetch(`${appUrl}/api/admin/scrape`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ADMIN_SECRET}`,
      },
    });

    const data = await res.json();
    console.log("[Cron] Auto-sync completed:", data);

    return NextResponse.json({ success: res.ok, ...data });
  } catch (error) {
    console.error("[Cron] Auto-sync failed:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
