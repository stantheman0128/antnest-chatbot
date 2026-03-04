import { NextRequest, NextResponse } from "next/server";
import { getAvailabilityRules, upsertAvailability, deleteAvailability } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  return NextResponse.json(await getAvailabilityRules());
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  if (body.weekday === undefined || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: "weekday, startTime, endTime required" }, { status: 400 });
  }

  const result = await upsertAvailability(body);
  if (!result) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ok = await deleteAvailability(id);
  if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ success: true });
}
