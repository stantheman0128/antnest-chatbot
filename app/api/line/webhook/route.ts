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
import { getAvailableSlots, getSlotById, createReservation } from "@/lib/data-service";
import type { PickupSlot } from "@/lib/data-service";
import { notifyOwnerNewReservation } from "@/lib/notify";

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

async function getLineProfile(userId: string): Promise<{ displayName: string } | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatSlotLabel(slot: PickupSlot): string {
  const d = new Date(slot.slotDate + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const w = WEEKDAYS[d.getDay()];
  const remaining = slot.maxCapacity - slot.currentBookings;
  // e.g. "3/10(一)14:00 剩3" — stays within 20 char LINE label limit
  return `${m}/${day}(${w})${slot.startTime.slice(0, 5)} 剩${remaining}`;
}

async function sendPickupSlots(replyToken: string, userId: string | undefined) {
  const slots = await getAvailableSlots();
  if (slots.length === 0) {
    const msg: TextMessage = {
      type: "text",
      text: "目前沒有可預約的取貨時段，請稍後再試或直接聯繫闆娘 😊",
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const items = slots.slice(0, 13).map((slot) => ({
    type: "action" as const,
    action: {
      type: "message" as const,
      label: formatSlotLabel(slot),
      text: `BOOK_SLOT:${slot.id}`,
    },
  }));

  const msg: TextMessage = {
    type: "text",
    text: "以下是可預約的取貨時段，請選擇你方便的時間 📅",
    quickReply: { items },
  };
  await sendMessages(replyToken, userId, [msg]);
}

async function handleBookSlot(replyToken: string, userId: string, slotId: string) {
  const slot = await getSlotById(slotId);
  if (!slot || slot.currentBookings >= slot.maxCapacity) {
    const msg: TextMessage = {
      type: "text",
      text: "抱歉，這個時段剛好預約滿了！請重新選擇 😅",
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const profile = await getLineProfile(userId);
  const displayName = profile?.displayName || "LINE用戶";

  const reservation = await createReservation({ slotId, lineUserId: userId, displayName });
  if (!reservation) {
    const msg: TextMessage = { type: "text", text: "預約失敗，請稍後再試" };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const d = new Date(slot.slotDate + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const w = WEEKDAYS[d.getDay()];

  const confirmMsg: TextMessage = {
    type: "text",
    text: `✅ 預約成功！\n\n📅 ${m}月${day}日（週${w}）\n⏰ ${slot.startTime.slice(0, 5)}–${slot.endTime.slice(0, 5)}\n\n有問題請聯繫闆娘 😊`,
    quickReply: getQuickReply(false),
  };
  await sendMessages(replyToken, userId, [confirmMsg]);

  notifyOwnerNewReservation({
    ...reservation,
    slotDate: slot.slotDate,
    slotStartTime: slot.startTime,
    slotEndTime: slot.endTime,
  }).catch(console.error);
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

  // "我的ID" → reply with LINE User ID (useful for owner setup)
  if (userMessage.trim() === "我的ID" || userMessage.trim() === "我的id") {
    const msg: TextMessage = {
      type: "text",
      text: `你的 LINE User ID：\n${userId || "（無法取得）"}`,
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // Slot booking from QuickReply tap — bypass AI and pause state
  if (userMessage.startsWith("BOOK_SLOT:") && userId) {
    const slotId = userMessage.replace("BOOK_SLOT:", "").trim();
    await handleBookSlot(event.replyToken, userId, slotId);
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

  // AI wants to show pickup slots → show as QuickReply buttons in chat
  if (aiResponse.showPickupLink) {
    await sendPickupSlots(event.replyToken, userId);
    console.log("LINE: Pickup slots sent to user");
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
