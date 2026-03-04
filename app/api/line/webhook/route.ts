import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  Message,
} from "@line/bot-sdk";
import { generateAIResponse, splitResponse } from "@/lib/ai-client";
import { buildProductCarousel } from "@/lib/flex-message";
import { getQuickReply, getPausedQuickReply } from "@/lib/quick-replies";

// Extend Vercel function timeout (free plan: max 60s)
export const maxDuration = 30;

// Dedup: prevent processing the same event multiple times
const recentEvents = new Map<string, number>();
const DEDUP_TTL = 30_000; // 30 seconds

// Human handoff: bot pauses for specific users
interface PauseState {
  pausedAt: number;
  lastActivity: number;
}
const pausedUsers = new Map<string, PauseState>();
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min of no activity → auto-resume

function isUserPaused(userId: string): boolean {
  const state = pausedUsers.get(userId);
  if (!state) return false;
  if (Date.now() - state.lastActivity > IDLE_TIMEOUT) {
    pausedUsers.delete(userId);
    return false;
  }
  return true;
}

function pauseUser(userId: string) {
  const now = Date.now();
  pausedUsers.set(userId, { pausedAt: now, lastActivity: now });
}

function resumeUser(userId: string) {
  pausedUsers.delete(userId);
}

/** Reset idle timer — called when paused user sends a message */
function touchPausedUser(userId: string) {
  const state = pausedUsers.get(userId);
  if (state) {
    state.lastActivity = Date.now();
  }
}

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

  // "呼叫闆娘" → pause bot, hand off to human
  if (userMessage.includes("呼叫闆娘")) {
    if (userId) pauseUser(userId);
    const msg: TextMessage = {
      type: "text",
      text: "好的，已為你轉接闆娘本人～\n她會盡快回覆你喔！請稍等一下 😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: Human handoff, bot paused for user", userId);
    return;
  }

  // "呼叫客服" → resume bot
  if (userMessage.includes("呼叫小螞蟻") || userMessage.includes("呼叫客服")) {
    if (userId) resumeUser(userId);
    const msg: TextMessage = {
      type: "text",
      text: "小螞蟻回來啦！🐜\n有什麼可以幫你的嗎？",
      quickReply: getQuickReply(false),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: Bot resumed for user", userId);
    return;
  }

  // If bot is hard-paused for this user (manual "呼叫闆娘"), don't respond at all
  if (userId && isUserPaused(userId)) {
    touchPausedUser(userId);
    console.log("LINE: Bot hard-paused for user, skipping", userId);
    return;
  }

  const aiResponse = await generateAIResponse(userMessage, []);

  // AI decided this message doesn't need a response → stay silent (no loading bubble)
  if (aiResponse.skip) {
    console.log("LINE: AI skipped message:", userMessage);
    return;
  }

  // AI decided this needs human handoff → escalate (no hard pause)
  if (aiResponse.escalate) {
    const msg: TextMessage = {
      type: "text",
      text: aiResponse.text || "這個問題幫你轉接闆娘～她會盡快回覆你喔！😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: AI escalated to human, reason:", aiResponse.escalateReason);
    return;
  }

  // AI wants to show pickup booking link
  if (aiResponse.showPickupLink) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
    const bookingUrl = `${baseUrl}/booking`;
    const messages: Message[] = [];

    if (aiResponse.text) {
      const segments = splitResponse(aiResponse.text, 2);
      segments.forEach((seg) => {
        messages.push({ type: "text", text: seg } as TextMessage);
      });
    }

    messages.push({
      type: "template",
      altText: "預約取貨時間",
      template: {
        type: "buttons",
        text: "點下方按鈕選擇你方便的取貨時間：",
        actions: [
          {
            type: "uri",
            label: "📅 選擇取貨時間",
            uri: bookingUrl,
          },
        ],
      },
    } as any);

    await sendMessages(event.replyToken, userId, messages);
    console.log("LINE: Pickup link sent to user");
    return;
  }

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
    const carousel = await buildProductCarousel(aiResponse.productIds);
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
