import { NextRequest, NextResponse } from "next/server";
import { getAllReservations, updateReservationStatus, createReservation, getAvailabilityById } from "@/lib/data-service";
import { verifyAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const date = req.nextUrl.searchParams.get("date") || undefined;
  const upcoming = req.nextUrl.searchParams.get("upcoming");

  if (upcoming === "true") {
    // Get reservations for today + next 7 days
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const all = await getAllReservations();
    const filtered = all.filter(
      (r) => r.availableDate && dates.includes(r.availableDate) && r.status !== "cancelled"
    );
    return NextResponse.json(filtered);
  }

  return NextResponse.json(await getAllReservations(date));
}

export async function POST(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const { availabilityId, displayName, pickupTime, orderNumber, note, bookingType, flexiblePeriod } = await req.json();

  if (!availabilityId || !displayName?.trim()) {
    return NextResponse.json({ error: "availabilityId and displayName required" }, { status: 400 });
  }

  const avail = await getAvailabilityById(availabilityId);
  if (!avail) return NextResponse.json({ error: "Date not found" }, { status: 404 });

  const reservation = await createReservation({
    availabilityId,
    displayName: displayName.trim(),
    pickupTime: pickupTime || "00:00",
    orderNumber: orderNumber?.trim() || undefined,
    note: note?.trim() || undefined,
    bookingType: bookingType || "exact",
    flexiblePeriod: flexiblePeriod || undefined,
  });

  if (!reservation) {
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
  return NextResponse.json(reservation, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const authError = await verifyAdmin(req);
  if (authError) return authError;

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const ok = await updateReservationStatus(id, status);
  if (!ok) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ success: true });
}
