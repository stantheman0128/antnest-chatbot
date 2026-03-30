import { NextResponse } from 'next/server';

import { getAvailableDates } from '@/lib/data-service';

export async function GET() {
  const dates = await getAvailableDates();
  return NextResponse.json(dates);
}
