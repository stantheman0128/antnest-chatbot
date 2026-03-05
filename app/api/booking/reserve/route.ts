import { NextRequest, NextResponse } from "next/server";
import { createReservation, getAvailabilityById } from "@/lib/data-service";
import { notifyOwnerNewReservation } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { availabilityId, lineUserId, displayName, pickupTime, orderNumber, note } =
    await req.json();

  if (!availabilityId || !displayName?.trim() || !pickupTime) {
    return NextResponse.json(
      { error: "availabilityId, displayName, and pickupTime are required" },
      { status: 400 }
    );
  }

  // Verify availability exists and has capacity
  const avail = await getAvailabilityById(availabilityId);
  if (!avail) return NextResponse.json({ error: "Date not found" }, { status: 404 });
  if (avail.currentBookings >= avail.maxBookings) {
    return NextResponse.json({ error: "This date is fully booked" }, { status: 409 });
  }

  const reservation = await createReservation({
    availabilityId,
    lineUserId: lineUserId || undefined,
    displayName: displayName.trim(),
    pickupTime,
    orderNumber: orderNumber?.trim() || undefined,
    note: note?.trim() || undefined,
  });

  if (!reservation) {
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }

  notifyOwnerNewReservation({
    ...reservation,
    availableDate: avail.availableDate,
  }).catch(console.error);

  return NextResponse.json(reservation, { status: 201 });
}
