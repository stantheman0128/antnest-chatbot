import { NextRequest, NextResponse } from "next/server";
import { createReservation, getSlotById } from "@/lib/data-service";
import { notifyOwnerNewReservation } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { slotId, lineUserId, displayName, orderNumber, note } = await req.json();

  if (!slotId || !displayName?.trim()) {
    return NextResponse.json({ error: "slotId and displayName required" }, { status: 400 });
  }

  // Verify slot exists and has capacity
  const slot = await getSlotById(slotId);
  if (!slot) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  if (slot.currentBookings >= slot.maxCapacity) {
    return NextResponse.json({ error: "Slot is full" }, { status: 409 });
  }

  const reservation = await createReservation({
    slotId,
    lineUserId,
    displayName: displayName.trim(),
    orderNumber: orderNumber?.trim() || undefined,
    note: note?.trim() || undefined,
  });

  if (!reservation) {
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }

  // Notify owner async (don't block response)
  notifyOwnerNewReservation({
    ...reservation,
    slotDate: slot.slotDate,
    slotStartTime: slot.startTime,
    slotEndTime: slot.endTime,
  }).catch(console.error);

  return NextResponse.json(reservation, { status: 201 });
}
