import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  Message,
} from "@line/bot-sdk";
import { generateAIResponse, splitResponse } from "@/lib/ai-client";
import { buildProductCarousel } from "@/lib/flex-message";
import { buildPickupDateCarousel, buildCustomerReservationFlex, buildTimeTypeChooser, PERIOD_INFO } from "@/lib/pickup-flex";
import { getQuickReply, getPausedQuickReply } from "@/lib/quick-replies";
import {
  getAvailableDates,
  getAvailabilityById,
  createReservation,
  getLatestReservationByUser,
  updateReservationStatus,
  updateReservationNote,
  getConfig,
  setConfig,
  deleteConfig,
} from "@/lib/data-service";

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

async function sendMessages(
  replyToken: string,
  userId: string | undefined,
  messages: Message[]
) {
  await getLineClient().replyMessage(replyToken, messages);
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

/** Send pickup date carousel */
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
    text: "以下是可取貨的日期，請選擇 📅",
  };

  await sendMessages(replyToken, userId, [intro, carousel as Message]);
}

/** Handle SELECT_DATE postback — show time type chooser */
async function handleDateSelected(
  replyToken: string,
  userId: string,
  availabilityId: string
) {
  const avail = await getAvailabilityById(availabilityId);
  if (!avail) {
    const msg: TextMessage = { type: "text", text: "此日期已失效，請重新選擇 😅" };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const chooser = buildTimeTypeChooser(avail);
  await sendMessages(replyToken, userId, [chooser as Message]);
}

/** Handle PICK_TIME_EXACT postback — exact time booking */
async function handleExactTimeSelected(
  replyToken: string,
  userId: string,
  availabilityId: string,
  pickupTime: string
) {
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
    bookingType: "exact",
  });

  if (!reservation) {
    const msg: TextMessage = { type: "text", text: "預約失敗，請稍後再試" };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const dateLabel = avail.availableDate
    ? `${new Date(avail.availableDate + "T00:00:00").getMonth() + 1}/${new Date(avail.availableDate + "T00:00:00").getDate()}`
    : "";

  // Save pending note state
  await setConfig(`pending_note:${userId}`, reservation.id);

  const confirmMsg: TextMessage = {
    type: "text",
    text: `預約成功！\n\n📅 ${dateLabel}\n⏰ ${pickupTime.slice(0, 5)}\n\n如需修改請說「修改預約」😊`,
  };
  const notePrompt: TextMessage = {
    type: "text",
    text: "要加備註嗎？如果可以的話附上訂單編號，老闆娘找訂單會比較方便喔！\n\n不需要的話按「跳過」就好～",
    quickReply: {
      items: [
        {
          type: "action",
          action: { type: "postback", label: "跳過", data: "SKIP_NOTE", displayText: "跳過" },
        },
      ],
    },
  };
  await sendMessages(replyToken, userId, [confirmMsg, notePrompt]);
  touchBotActivity(userId);
}

/** Handle PICK_PERIOD postback — flexible time booking */
async function handleFlexiblePeriodSelected(
  replyToken: string,
  userId: string,
  availabilityId: string,
  period: string
) {
  const avail = await getAvailabilityById(availabilityId);
  if (!avail || avail.currentBookings >= avail.maxBookings) {
    const msg: TextMessage = {
      type: "text",
      text: "抱歉，這個日期剛好預約滿了！請重新選擇 😅",
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const profile = await getLineProfile(userId);
  const displayName = profile?.displayName || "LINE用戶";

  const periodInfo = PERIOD_INFO[period];
  const pickupTime = periodInfo?.start || "00:00";

  const reservation = await createReservation({
    availabilityId,
    lineUserId: userId,
    displayName,
    pickupTime,
    bookingType: "flexible",
    flexiblePeriod: period,
  });

  if (!reservation) {
    const msg: TextMessage = { type: "text", text: "預約失敗，請稍後再試" };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const dateLabel = avail.availableDate
    ? `${new Date(avail.availableDate + "T00:00:00").getMonth() + 1}/${new Date(avail.availableDate + "T00:00:00").getDate()}`
    : "";
  const periodLabel = periodInfo?.label || "時間待定";

  // Save pending note state
  await setConfig(`pending_note:${userId}`, reservation.id);

  const confirmMsg: TextMessage = {
    type: "text",
    text: `預約成功！\n\n📅 ${dateLabel}\n🕐 ${periodLabel}\n\n如需修改請說「修改預約」😊`,
  };
  const notePrompt: TextMessage = {
    type: "text",
    text: "要加備註嗎？如果可以的話附上訂單編號，老闆娘找訂單會比較方便喔！\n\n不需要的話按「跳過」就好～",
    quickReply: {
      items: [
        {
          type: "action",
          action: { type: "postback", label: "跳過", data: "SKIP_NOTE", displayText: "跳過" },
        },
      ],
    },
  };
  await sendMessages(replyToken, userId, [confirmMsg, notePrompt]);
  touchBotActivity(userId);
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

  // Pending note: if user just made a reservation and types text, save as note
  if (userId) {
    const pendingResId = await getConfig(`pending_note:${userId}`);
    if (pendingResId) {
      await updateReservationNote(pendingResId, userMessage);
      await deleteConfig(`pending_note:${userId}`);
      const msg: TextMessage = {
        type: "text",
        text: "已加入備註！",
        quickReply: getPausedQuickReply(),
      };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
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

  // 查詢/取消/修改預約 → bypass active check
  if (
    userId &&
    (userMessage.includes("取消預約") ||
      userMessage.includes("修改預約") ||
      userMessage.includes("我的預約") ||
      userMessage.includes("查看預約") ||
      userMessage.includes("改預約"))
  ) {
    const reservation = await getLatestReservationByUser(userId);
    if (!reservation) {
      const msg: TextMessage = {
        type: "text",
        text: "查無預約紀錄喔！\n如需預約請點下方「我要預約取貨」😊",
        quickReply: getPausedQuickReply(),
      };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    const flex = buildCustomerReservationFlex(reservation);
    await sendMessages(event.replyToken, userId, [flex as Message]);
    return;
  }

  // 下次開單 → reply with configured announcement
  if (
    userMessage.includes("下次開單") ||
    userMessage.includes("開單時間")
  ) {
    const announcement = await getConfig("next_order_announcement");
    const msg: TextMessage = {
      type: "text",
      text: announcement || "目前還沒有下次開單的資訊喔～\n請追蹤我們的官方帳號以獲取最新消息 😊",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // "我的ID" → reply with LINE User ID
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

  if (aiResponse.skip) {
    console.log("LINE: AI skipped message:", userMessage);
    return;
  }

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
  const time = event.postback.params?.time;

  // Customer selects a date → show time type chooser
  if (data.startsWith("SELECT_DATE:") && userId) {
    const availabilityId = data.replace("SELECT_DATE:", "").trim();
    await handleDateSelected(event.replyToken, userId, availabilityId);
    return;
  }

  // Customer selects exact time via DateTimePicker
  if (data.startsWith("PICK_TIME_EXACT:") && userId && time) {
    const availabilityId = data.replace("PICK_TIME_EXACT:", "").trim();
    await handleExactTimeSelected(event.replyToken, userId, availabilityId, time);
    return;
  }

  // Customer selects a flexible period
  if (data.startsWith("PICK_PERIOD:") && userId) {
    const parts = data.replace("PICK_PERIOD:", "").split(":");
    const availabilityId = parts[0]?.trim();
    const period = parts[1]?.trim();
    if (availabilityId && period) {
      await handleFlexiblePeriodSelected(event.replyToken, userId, availabilityId, period);
    }
    return;
  }

  // Legacy: old PICK_TIME postback (from old Flex messages still in chat history)
  if (data.startsWith("PICK_TIME:") && userId && time) {
    const availabilityId = data.replace("PICK_TIME:", "").trim();
    await handleExactTimeSelected(event.replyToken, userId, availabilityId, time);
    return;
  }

  // Customer cancels reservation
  if (data.startsWith("CANCEL_MY_RES:") && userId) {
    const id = data.replace("CANCEL_MY_RES:", "").trim();
    await updateReservationStatus(id, "cancelled");
    const msg: TextMessage = {
      type: "text",
      text: "已取消你的預約 ✅\n\n如需重新預約，請點「我要預約取貨」😊",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log("LINE: Customer cancelled reservation", id);
    return;
  }

  // Customer wants to rebook (modify = cancel + rebook)
  if (data.startsWith("REBOOK:") && userId) {
    const id = data.replace("REBOOK:", "").trim();
    await updateReservationStatus(id, "cancelled");
    await sendPickupDateCarousel(event.replyToken, userId);
    if (userId) touchBotActivity(userId);
    console.log("LINE: Customer rebooking after cancelling", id);
    return;
  }

  // Customer skips note after reservation
  if (data === "SKIP_NOTE" && userId) {
    await deleteConfig(`pending_note:${userId}`);
    const msg: TextMessage = {
      type: "text",
      text: "好的！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // Legacy: old CONFIRM_RES/REJECT_RES from chat history
  if (data.startsWith("CONFIRM_RES:") || data.startsWith("REJECT_RES:")) {
    const msg: TextMessage = { type: "text", text: "此功能已更新，請至後台管理預約 🙂" };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  console.log("LINE: Unhandled postback data:", data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-line-signature");

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
