import { NextRequest, NextResponse } from 'next/server';

import { type MessageHistory, generateAIResponse } from '@/lib/ai-client';
import { createRateLimiter } from '@/lib/rate-limiter';

export const maxDuration = 60;

// Cap abuse of the paid LLM endpoint: per-IP rate limit + payload size limits.
const limiter = createRateLimiter({ max: 20, windowMs: 60 * 1000 });
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 20;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  if (!limiter.hit(clientIp(req), Date.now())) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const { message, history } = (await req.json()) as {
      message: string;
      history?: MessageHistory[];
    };

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];

    const aiResponse = await generateAIResponse(message, trimmedHistory);
    return NextResponse.json({
      response: aiResponse.text,
      productIds: aiResponse.productSpecs.map((s) => s.id),
      source: 'ai',
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        response:
          '抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com',
        productIds: [],
        source: 'error',
      },
      { status: 500 },
    );
  }
}
