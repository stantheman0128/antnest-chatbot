import { NextResponse } from "next/server";

// pickup_slots table no longer exists — replaced by pickup_availability (date-based).
export async function GET() {
  return NextResponse.json({ error: "Gone — use /api/admin/pickup/availability" }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Gone — use /api/admin/pickup/availability" }, { status: 410 });
}
