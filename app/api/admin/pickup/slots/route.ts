import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, ensureSlotsGenerated } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  return NextResponse.json(await getAvailableSlots());
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  await ensureSlotsGenerated(4);
  return NextResponse.json({ success: true });
}
