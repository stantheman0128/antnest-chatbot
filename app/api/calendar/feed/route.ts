import { NextRequest, NextResponse } from 'next/server';

import { getConfig, getConfirmedReservationsForCalendar } from '@/lib/data-service';
import { PERIOD_INFO } from '@/lib/pickup-flex';

/**
 * GET /api/calendar/feed?token=SECRET
 * Returns an iCal feed of all confirmed reservations.
 * Subscribe in Apple Calendar / Google Calendar for auto-sync.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const secret = process.env.CALENDAR_SECRET || (await getConfig('calendar_secret'));

  if (!token || !secret || token !== secret) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const reservations = await getConfirmedReservationsForCalendar();
  const ical = generateICalFeed(reservations);

  return new NextResponse(ical, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="antnest-pickup.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeIcal(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toICalDate(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
}

function addMinutes(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  return `${pad(Math.floor(totalMin / 60) % 24)}:${pad(totalMin % 60)}`;
}

interface CalReservation {
  id: string;
  displayName: string;
  pickupTime: string;
  orderNumber: string | null;
  note: string | null;
  bookingType: string;
  flexiblePeriod: string | null;
  createdAt: string;
  availableDate?: string;
}

function generateICalFeed(reservations: CalReservation[]): string {
  const events = reservations
    .filter((r) => r.availableDate)
    .map((r) => {
      const date = r.availableDate!;
      let dtStart: string;
      let dtEnd: string;
      let summaryPrefix: string;
      let allDay = false;

      if (r.bookingType === 'flexible' && r.flexiblePeriod) {
        const info = PERIOD_INFO[r.flexiblePeriod];
        if (r.flexiblePeriod === 'tbd') {
          // All-day event
          allDay = true;
          const [y, m, d] = date.split('-').map(Number);
          dtStart = `${y}${pad(m)}${pad(d)}`;
          // DTEND for all-day is next day
          const next = new Date(y, m - 1, d + 1);
          dtEnd = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
          summaryPrefix = '取貨(待定)';
        } else if (info) {
          dtStart = toICalDate(date, info.start);
          dtEnd = toICalDate(date, info.end);
          summaryPrefix = `取貨(${info.label.split('（')[0]})`;
        } else {
          dtStart = toICalDate(date, r.pickupTime || '14:00');
          dtEnd = toICalDate(date, addMinutes(r.pickupTime || '14:00', 120));
          summaryPrefix = '取貨';
        }
      } else {
        // Exact time: 30-minute event
        dtStart = toICalDate(date, r.pickupTime);
        dtEnd = toICalDate(date, addMinutes(r.pickupTime, 30));
        summaryPrefix = '取貨';
      }

      const summary = escapeIcal(`${summaryPrefix} - ${r.displayName}`);
      const descParts: string[] = [];
      if (r.orderNumber) descParts.push(`訂單：${r.orderNumber}`);
      if (r.note) descParts.push(`備註：${r.note}`);
      const description = escapeIcal(descParts.join('\n'));

      // Format createdAt as DTSTAMP
      const created = new Date(r.createdAt);
      const dtstamp = `${created.getUTCFullYear()}${pad(created.getUTCMonth() + 1)}${pad(created.getUTCDate())}T${pad(created.getUTCHours())}${pad(created.getUTCMinutes())}${pad(created.getUTCSeconds())}Z`;

      const lines = ['BEGIN:VEVENT', `UID:${r.id}@antnest-chatbot`, `DTSTAMP:${dtstamp}`];

      if (allDay) {
        lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
        lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      } else {
        lines.push(`DTSTART;TZID=Asia/Taipei:${dtStart}`);
        lines.push(`DTEND;TZID=Asia/Taipei:${dtEnd}`);
      }

      lines.push(
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
      );

      return lines.join('\r\n');
    });

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Antnest//Pickup//ZH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:螞蟻窩取貨預約',
    'X-WR-TIMEZONE:Asia/Taipei',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Taipei',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return cal;
}
