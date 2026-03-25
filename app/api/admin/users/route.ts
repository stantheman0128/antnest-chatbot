import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin-auth";
import { getAllLineUsers, getConversationHistory } from "@/lib/data-service";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const userId = req.nextUrl.searchParams.get("id");

  if (userId) {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const history = await getConversationHistory(userId, limit);
    return NextResponse.json(history);
  }

  const users = await getAllLineUsers();
  return NextResponse.json(users);
}
