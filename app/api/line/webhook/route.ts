import { NextRequest, NextResponse } from 'next/server';

import { WebhookEvent, validateSignature } from '@line/bot-sdk';

import { handlePostback } from './handlers/postback';
import { isDuplicate } from './handlers/shared';
import { handleTextMessage } from './handlers/text-message';

// Extend Vercel function timeout (free plan: max 60s, Pro: max 300s)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('x-line-signature');
    const channelSecret = process.env.LINE_CHANNEL_SECRET || '';

    // Verify LINE signature — reject forged requests
    if (!signature || !channelSecret || !validateSignature(body, channelSecret, signature)) {
      console.log('LINE: Invalid or missing signature, rejecting');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const parsed = JSON.parse(body) as {
      events: (WebhookEvent & { webhookEventId?: string })[];
    };
    const events = parsed.events;

    await Promise.all(
      events.map(async (event) => {
        const eventId =
          (event.type === 'message' ? event.message.id : undefined) ||
          event.webhookEventId ||
          event.timestamp?.toString();
        if (eventId && isDuplicate(eventId)) {
          console.log('Skipping duplicate event:', eventId);
          return;
        }

        if (event.type === 'message' && event.message.type === 'text') {
          await handleTextMessage(event as Parameters<typeof handleTextMessage>[0]);
          return;
        }

        if (event.type === 'postback') {
          await handlePostback(event as Parameters<typeof handlePostback>[0]);
          return;
        }
      }),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LINE webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
