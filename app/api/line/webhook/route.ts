import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  Message,
} from "@line/bot-sdk";
import { generateAIResponse, splitResponse } from "@/lib/ai-client";
import { buildProductCarousel } from "@/lib/flex-message";
import { buildPickupDateCarousel } from "@/lib/pickup-flex";
import { getQuickReply, getPausedQuickReply } from "@/lib/quick-replies";
import {
  getAvailableDates,
  getAvailabilityById,
  createReservation,
} from "@/lib/data-service";
import { notifyOwnerNewReservation } from "@/lib/notify";

// Extend Vercel function timeout (free plan: max 60s)
export const maxDuration = 30;

// Dedup: prevent processing the same event multiple times
const recentEvents = new Map<string, number>();
const DEDUP_TTL = 30_000; // 30 seconds

// Opt-in: bot is silent by default, activated by "呼叫小螞蟻"
interface ActiveState {
  activatedAt: number;
  lastBotActivity: number;
}
const activeUsers = new Map<string, ActiveState>();
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min without bot response → auto-deactivate

function isUserActive(userId: string): boolean {
  const state = activeUsers.get(userId);
  if (!state) return false;
  if (Date.now() - state.lastBotActivity > IDLE_TIMEOUT) {
    activeUsers.delete(userId);
    return false;
  }
  return true;
}

function activateUser(userId: string) {
  const now = Date.now();
  activeUsers.set(userId, { activatedAt: now, lastBotActivity: now });
}

function deactivateUser(userId: string) {
  activeUsers.delete(userId);
}

/** Extend idle timeout — called after bot sends a message */
function touchBotActivity(userId: string) {
  const state = activeUsers.get(userId);
  if (state) {
    state.lastBotActivity = Date.now();
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

/** Send pickup date carousel (Flex Message with DateTimePicker buttons) */
async function sendPickupDateCarousel(replyToken: string, userId: string | undefined) {
  const availabilities = await getAvailableDates();

  if (availabilities.length === 0) {
    const msg: TextMessage = {
      type: "text",
      text: "目前沒有可預約的取貨時段，請稍後再試或直接聯繫闆娘 😊",
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const carousel = buildPickupDateCarousel(availabilities);
  if (!carousel) return;

  const intro: TextMessage = {
    type: "text",
    text: "以下是可取貨的日期，請選擇並選好取貨時間 📅",
  };

  await sendMessages(replyToken, userId, [intro, carousel as Message]);
}

/** Handle postback from DateTimePicker: PICK_TIME:{availabilityId} */
async function handlePickupTimeSelected(
  replyToken: string,
  userId: string,
  data: string,
  pickupTime: string
) {
  const availabilityId = data.replace("PICK_TIME:", "").trim();

  const avail = await getAvailabilityById(availabilityId);
  if (!avail || avail.currentBookings >= avail.maxBookings) {
    const msg: TextMessage = {
      type: "text",
      text: "抱歉，這個時段剛好預約滿了！請重新選擇 😅",
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const profile = await getLineProfile(userId);
  const displayName = profile?.displayName || "LINE用戶";

  const reservation = await createReservation({
    availabilityId,
    lineUserId: userId,
    displayName,
    pickupTime,
  });

  if (!reservation) {
    const msg: TextMessage = { type: "text", text: "預約失敗，請稍後再試" };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const d = new Date(avail.availableDate + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
  const w = WEEKDAYS[d.getDay()];

  const confirmMsg: TextMessage = {
    type: "text",
    text: `✅ 預約成功！\n\n📅 ${m}月${day}日（週${w}）\n⏰ ${pickupTime.slice(0, 5)}\n\n有問題請聯繫闆娘 😊`,
    quickReply: getQuickReply(false),
  };
  await sendMessages(replyToken, userId, [confirmMsg]);
  touchBotActivity(userId);

  notifyOwnerNewReservation({
    ...reservation,
    availableDate: avail.availableDate,
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

  // "呼叫闆娘" → deactivate bot, hand off to human
  if (userMessage.includes("呼叫闆娘")) {
    if (userId) deactivateUser(userId);
    const msg: TextMessage = {
      type: "text",
      text: "好的，已為你轉接闆娘本人～\n她會盡快回覆你喔！請稍等一下 😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: Human handoff, bot paused for user", userId);
    return;
  }

  // "呼叫小螞蟻" → activate bot
  if (userMessage.includes("呼叫小螞蟻") || userMessage.includes("呼叫客服")) {
    if (userId) activateUser(userId);
    const msg: TextMessage = {
      type: "text",
      text: "小螞蟻回來啦！🐜\n有什麼可以幫你的嗎？",
      quickReply: getQuickReply(false),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: Bot resumed for user", userId);
    return;
  }

  // 預約取貨關鍵字 → bypass AI, show date carousel directly
  if (
    userMessage.includes("我要預約取貨") ||
    userMessage.includes("我要預約") ||
    userMessage.includes("預約取貨") ||
    userMessage.includes("約取貨") ||
    userMessage.includes("我要約取貨")
  ) {
    if (userId) activateUser(userId);
    await sendPickupDateCarousel(event.replyToken, userId);
    if (userId) touchBotActivity(userId);
    console.log("LINE: Pickup carousel triggered by keyword:", userMessage);
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

  // Bot is opt-in — only respond if user has activated it
  if (!userId || !isUserActive(userId)) {
    console.log("LINE: Bot inactive for user, skipping:", userId);
    return;
  }

  const aiResponse = await generateAIResponse(userMessage, []);

  // AI decided this message doesn't need a response → stay silent
  if (aiResponse.skip) {
    console.log("LINE: AI skipped message:", userMessage);
    return;
  }

  // AI decided this needs human handoff → escalate
  if (aiResponse.escalate) {
    const msg: TextMessage = {
      type: "text",
      text: aiResponse.text || "這個問題幫你轉接闆娘～她會盡快回覆你喔！😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    if (userId) deactivateUser(userId);
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: AI escalated to human, reason:", aiResponse.escalateReason);
    return;
  }

  // AI wants to show pickup slots → send Flex Carousel with DateTimePicker
  if (aiResponse.showPickupLink) {
    await sendPickupDateCarousel(event.replyToken, userId);
    console.log("LINE: Pickup date carousel sent to user");
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
  if (userId) touchBotActivity(userId);
}

async function handlePostback(
  event: WebhookEvent & {
    type: "postback";
    postback: { data: string; params?: { time?: string } };
    source: { userId?: string };
  }
) {
  const userId = event.source.userId;
  const data = event.postback.data;
  const time = event.postback.params?.time; // e.g. "15:30"

  if (data.startsWith("PICK_TIME:") && userId && time) {
    await handlePickupTimeSelected(event.replyToken, userId, data, time);
    return;
  }

  console.log("LINE: Unhandled postback data:", data);
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

        if (event.type === "postback") {
          await handlePostback(event as any);
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
