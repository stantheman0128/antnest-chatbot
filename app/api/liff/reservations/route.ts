import { NextRequest, NextResponse } from 'next/server';

import {
  getReservationById,
  getReservationsByUser,
  updateReservationNote,
  updateReservationOrderNumber,
  updateReservationStatus,
} from '@/lib/data-service';

/** GET: list a user's active reservations */
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });
  }

  const reservations = await getReservationsByUser(lineUserId);
  return NextResponse.json(reservations);
}

/** PATCH: cancel or modify a reservation (ownership verified) */
export async function PATCH(req: NextRequest) {
  const { reservationId, lineUserId, action, value } = (await req.json()) as {
    reservationId: string;
    lineUserId: string;
    action: string;
    value?: string;
  };

  if (!reservationId || !lineUserId || !action) {
    return NextResponse.json(
      { error: 'reservationId, lineUserId, and action are required' },
      { status: 400 },
    );
  }

  // Ownership verification
  const reservation = await getReservationById(reservationId);
  if (!reservation) {
    return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
  }
  if (reservation.lineUserId !== lineUserId) {
    return NextResponse.json({ error: 'Not your reservation' }, { status: 403 });
  }

  let ok = false;
  switch (action) {
    case 'cancel':
      ok = await updateReservationStatus(reservationId, 'cancelled');
      break;
    case 'update_note':
      ok = await updateReservationNote(reservationId, value || '');
      break;
    case 'update_order':
      ok = await updateReservationOrderNumber(reservationId, value || '');
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return ok
    ? NextResponse.json({ success: true })
    : NextResponse.json({ error: 'Operation failed' }, { status: 500 });
}
