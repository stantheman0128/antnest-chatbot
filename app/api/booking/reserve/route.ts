import { NextRequest, NextResponse } from 'next/server';

import { createReservation, getAvailabilityById } from '@/lib/data-service';
import { verifyLiffUser } from '@/lib/liff-auth';
import { createRateLimiter } from '@/lib/rate-limiter';

// Throttle booking spam per IP (in-memory, per-instance).
const limiter = createRateLimiter({ max: 10, windowMs: 60 * 1000 });

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

const MAX_NAME = 100;
const MAX_NOTE = 500;
const MAX_ORDER = 100;

export async function POST(req: NextRequest) {
  if (!limiter.hit(clientIp(req), Date.now())) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Reservations must be tied to a LINE identity verified server-side.
  const lineUserId = await verifyLiffUser(req);
  if (!lineUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    availabilityId,
    displayName,
    pickupTime,
    orderNumber,
    note,
    bookingType,
    flexiblePeriod,
  } = (await req.json()) as {
    availabilityId: string;
    displayName: string;
    pickupTime: string;
    orderNumber?: string;
    note?: string;
    bookingType?: string;
    flexiblePeriod?: string;
  };

  if (!availabilityId || !displayName?.trim() || !pickupTime) {
    return NextResponse.json(
      { error: 'availabilityId, displayName, and pickupTime are required' },
      { status: 400 },
    );
  }
  if (
    displayName.length > MAX_NAME ||
    (note?.length ?? 0) > MAX_NOTE ||
    (orderNumber?.length ?? 0) > MAX_ORDER
  ) {
    return NextResponse.json({ error: 'Input too long' }, { status: 400 });
  }

  // Verify availability exists and has capacity
  const avail = await getAvailabilityById(availabilityId);
  if (!avail) return NextResponse.json({ error: 'Date not found' }, { status: 404 });
  if (avail.currentBookings >= avail.maxBookings) {
    return NextResponse.json({ error: 'This date is fully booked' }, { status: 409 });
  }

  const reservation = await createReservation({
    availabilityId,
    lineUserId,
    displayName: displayName.trim(),
    pickupTime,
    orderNumber: orderNumber?.trim() || undefined,
    note: note?.trim() || undefined,
    bookingType: (bookingType || 'exact') as 'exact' | 'flexible',
    flexiblePeriod: flexiblePeriod || undefined,
  });

  if (!reservation) {
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 });
  }

  return NextResponse.json(reservation, { status: 201 });
}
