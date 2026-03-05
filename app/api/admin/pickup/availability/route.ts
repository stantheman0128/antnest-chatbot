import { NextRequest, NextResponse } from "next/server";
import { getAllAvailabilities, bulkCreateAvailabilities, deleteAvailability } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;
  return NextResponse.json(await getAllAvailabilities());
}

export async function POST(req: NextRequest) {
  const authError = verifyAdmin(req);
  if (authError) return authError;

  const body = await req.json();
  const { dates, startTime, endTime, maxBookings } = body;

  if (!Array.isArray(dates) || dates.length === 0 || !startTime || !endTime) {
    return NextResponse.json(
      { error: "dates (array), startTime, endTime required" },
      { status: 400 }
    );
  }

  const results = await bulkCreateAvailabilities(
    dates,
    startTime,
    endTime,
    maxBookings ?? 10
  );
  return NextResponse.json(results, { status: 201 });
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
