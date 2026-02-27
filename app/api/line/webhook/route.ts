import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  StickerMessage,
  FlexMessage,
  Message,
} from "@line/bot-sdk";
import { generateAIResponse, splitResponse } from "@/lib/ai-client";
import { buildProductCarousel, getAllProductIds } from "@/lib/flex-message";
import { getQuickReply } from "@/lib/quick-replies";

// Extend Vercel function timeout (free plan: max 60s)
export const maxDuration = 30;

// Dedup: prevent processing the same event multiple times
// (CYBERBIZ may forward the same event more than once)
const recentEvents = new Map<string, number>();
const DEDUP_TTL = 30_000; // 30 seconds

function isDuplicate(eventId: string): boolean {
  const now = Date.now();
  // Clean old entries
  for (const [id, ts] of recentEvents) {
    if (now - ts > DEDUP_TTL) recentEvents.delete(id);
  }
  if (recentEvents.has(eventId)) return true;
  recentEvents.set(eventId, now);
  return false;
}

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

/**
 * Show loading animation in LINE chat (the "typing..." bubble)
 * Duration: 5-60 seconds, automatically dismissed when reply is sent
 */
async function showLoadingAnimation(userId: string) {
  try {
    await fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        chatId: userId,
        loadingSeconds: 30,
      }),
    });
  } catch (error) {
    console.error("Loading animation error:", error);
  }
}

/**
 * Send messages using push API (doesn't need replyToken).
 * Used when we receive events via CYBERBIZ forwarding, where
 * CYBERBIZ may have already consumed the replyToken.
 */
async function pushMessages(userId: string, messages: Message[]) {
  await getLineClient().pushMessage(userId, messages);
}

/**
 * Try reply first (free), fall back to push (uses quota) if token is expired.
 */
async function sendMessages(
  replyToken: string,
  userId: string | undefined,
  messages: Message[]
) {
  try {
    await getLineClient().replyMessage(replyToken, messages);
  } catch (error: any) {
    // replyToken already used (by CYBERBIZ) or expired → fall back to push
    if (userId && error?.statusCode === 400) {
      console.log("replyToken expired, falling back to push message");
      try {
        await pushMessages(userId, messages);
      } catch (pushError: any) {
        // 429 = rate limited, just log and give up
        console.error("Push message failed:", pushError?.statusCode || pushError);
      }
    } else {
      throw error;
    }
  }
}

function buildWelcomeMessages(): Message[] {
  const sticker: StickerMessage = {
    type: "sticker",
    packageId: "11537",
    stickerId: "52002734",
  };

  const welcomeText: TextMessage = {
    type: "text",
    text:
      "歡迎來到螞蟻窩甜點！🐜\n\n" +
      "我是小蟻，你的甜點小幫手～\n" +
      "可以直接打字問我任何問題，\n" +
      "或點選下方按鈕快速開始！\n\n" +
      "先來看看我們有什麼好吃的吧 👇",
    quickReply: getQuickReply(false),
  };

  const carousel = buildProductCarousel(getAllProductIds());
  const messages: Message[] = [sticker, welcomeText];
  if (carousel) messages.push(carousel);

  return messages;
}

async function handleTextMessage(
  event: WebhookEvent & {
    type: "message";
    message: { type: "text"; text: string };
    source: { userId?: string };
  }
) {
  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log("LINE message received:", userMessage);

  if (userId) {
    showLoadingAnimation(userId);
  }

  const aiResponse = await generateAIResponse(userMessage, []);
  const hasProducts = aiResponse.productIds.length > 0;

  const maxTextSegments = hasProducts ? 2 : 3;
  const segments = splitResponse(aiResponse.text, maxTextSegments);

  const textMessages: TextMessage[] = segments.map((seg) => ({
    type: "text",
    text: seg,
  }));

  textMessages[textMessages.length - 1].quickReply = getQuickReply(hasProducts);

  const messages: Message[] = [...textMessages];

  if (hasProducts) {
    const carousel = buildProductCarousel(aiResponse.productIds);
    if (carousel) messages.push(carousel);
  }

  console.log(
    "LINE: AI response sent",
    hasProducts
      ? `with ${aiResponse.productIds.length} product cards`
      : "(text only)"
  );

  await sendMessages(event.replyToken, userId, messages);
}

async function handleFollowEvent(
  event: WebhookEvent & { type: "follow"; source: { userId?: string } }
) {
  console.log("LINE: New follower!");
  const messages = buildWelcomeMessages();
  await sendMessages(event.replyToken, event.source.userId, messages);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

    // Accept requests with or without signature (CYBERBIZ forwarding may or may not include it)
    if (!signature) {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.events) {
          console.log("No events array, rejecting");
          return NextResponse.json({ error: "Unknown format" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
    }

    const events: WebhookEvent[] = JSON.parse(body).events;

    await Promise.all(
      events.map(async (event) => {
        // Dedup using webhook event ID or message ID
        const eventId =
          (event.type === "message" ? event.message.id : undefined) ||
          (event as any).webhookEventId ||
          event.timestamp?.toString();
        if (eventId && isDuplicate(eventId)) {
          console.log("Skipping duplicate event:", eventId);
          return;
        }

        if (event.type === "follow") {
          await handleFollowEvent(event as any);
          return;
        }

        if (event.type === "message" && event.message.type === "text") {
          await handleTextMessage(event as any);
          return;
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
