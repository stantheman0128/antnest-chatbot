import { NextRequest, NextResponse } from "next/server";
import { getAllReservations, updateReservationStatus } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const date = req.nextUrl.searchParams.get("date") || undefined;
  return NextResponse.json(await getAllReservations(date));
}

export async function PATCH(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const ok = await updateReservationStatus(id, status);
  if (!ok) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ success: true });
}
