import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getConversationHistory, getConversationStats, getCustomersWithContext } from "@/lib/data-service";
import { generateConversationSummary } from "@/lib/ai-client";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  // Stats endpoint
  if (req.nextUrl.searchParams.has("stats")) {
    const stats = await getConversationStats();
    return NextResponse.json(stats);
  }

  const userId = req.nextUrl.searchParams.get("id");

  if (userId) {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const history = await getConversationHistory(userId, limit);

    // AI summary
    if (req.nextUrl.searchParams.has("summary")) {
      const recentMessages = history.slice(0, 20).reverse().map((h) => ({
        role: h.role,
        content: h.content,
      }));
      const summary = await generateConversationSummary(recentMessages);
      return NextResponse.json({ summary });
    }

    return NextResponse.json(history);
  }

  // Default: customers with context (orders, message counts, flagged)
  const customers = await getCustomersWithContext();
  return NextResponse.json(customers);
}
