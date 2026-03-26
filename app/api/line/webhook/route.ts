import { NextRequest, NextResponse } from "next/server";
import {
  Client,
  WebhookEvent,
  TextMessage,
  Message,
  validateSignature,
} from "@line/bot-sdk";
import { generateAIResponse, splitResponse } from "@/lib/ai-client";
import { isStockQuery, refreshStockIfStale } from "@/lib/stock-checker";
import { buildProductCarousel } from "@/lib/flex-message";
import { buildPickupDateCarousel, buildCustomerReservationFlex, buildTimeTypeChooser, PERIOD_INFO } from "@/lib/pickup-flex";
import { getQuickReply, getPausedQuickReply } from "@/lib/quick-replies";
import {
  getAvailableDates,
  getAvailabilityById,
  createReservation,
  getReservationById,
  getLatestReservationByUser,
  updateReservationStatus,
  updateReservationNote,
  getConfig,
  setConfig,
  deleteConfig,
  upsertLineUser,
  logConversation,
  getConversationHistory,
} from "@/lib/data-service";

// Extend Vercel function timeout (free plan: max 60s, Pro: max 300s)
export const maxDuration = 60;

// Dedup: prevent processing the same event multiple times
const recentEvents = new Map<string, number>();
const DEDUP_TTL = 30_000; // 30 seconds

// Opt-in: bot is silent by default, activated by "呼叫小螞蟻"
// State persisted in Supabase system_config as `active_until:{userId}` = expiry timestamp
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min without bot response → auto-deactivate

async function isUserActive(userId: string): Promise<boolean> {
  const expiresAt = await getConfig(`active_until:${userId}`);
  if (!expiresAt) return false;
  if (Date.now() > parseInt(expiresAt)) {
    // Expired — clean up async (fire-and-forget)
    deleteConfig(`active_until:${userId}`);
    return false;
  }
  return true;
}

async function activateUser(userId: string) {
  const expiresAt = (Date.now() + IDLE_TIMEOUT).toString();
  await setConfig(`active_until:${userId}`, expiresAt);
}

async function deactivateUser(userId: string) {
  await deleteConfig(`active_until:${userId}`);
}

/** Extend idle timeout — called after bot sends a message */
async function touchBotActivity(userId: string) {
  const expiresAt = (Date.now() + IDLE_TIMEOUT).toString();
  await setConfig(`active_until:${userId}`, expiresAt);
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
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  return new Client({
    channelAccessToken: token,
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

/** Build pickup date carousel messages (does not send — caller decides) */
async function buildPickupMessages(introText?: string): Promise<Message[]> {
  const availabilities = await getAvailableDates();

  if (availabilities.length === 0) {
    const msg: TextMessage = {
      type: "text",
      text: "目前沒有可預約的取貨時段，請稍後再試或直接聯繫闆娘 😊",
      quickReply: getQuickReply(false),
    };
    return [msg];
  }

  const carousel = buildPickupDateCarousel(availabilities);
  if (!carousel) return [];

  const intro: TextMessage = {
    type: "text",
    text: introText || "以下是可取貨的日期，請選擇 📅",
  };

  return [intro, carousel as Message];
}

/** Send pickup date carousel */
async function sendPickupDateCarousel(replyToken: string, userId: string | undefined) {
  const messages = await buildPickupMessages();
  if (messages.length > 0) {
    await sendMessages(replyToken, userId, messages);
  }
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
    text: `預約成功！\n\n📅 ${dateLabel}\n⏰ ${pickupTime.slice(0, 5)}\n📍 新北市板橋區龍興街69號（浮洲火車站附近）\n\n如需修改請說「修改預約」😊`,
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
  await touchBotActivity(userId);
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
    text: `預約成功！\n\n📅 ${dateLabel}\n🕐 ${periodLabel}\n📍 新北市板橋區龍興街69號（浮洲火車站附近）\n\n如需修改請說「修改預約」😊`,
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
  await touchBotActivity(userId);
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

  // Log user + message (fire-and-forget)
  if (userId) {
    getLineProfile(userId).then((profile) => {
      upsertLineUser(userId, profile?.displayName || "LINE用戶", (profile as any)?.pictureUrl);
    }).catch(() => {});
    logConversation(userId, "user", userMessage);
  }

  // Guard: ignore absurdly long messages (likely spam or attack)
  if (userMessage.length > 2000) {
    console.log("LINE: Ignoring message exceeding 2000 chars, length:", userMessage.length);
    return;
  }

  // "呼叫闆娘" → deactivate bot, hand off to human
  if (userMessage.includes("呼叫闆娘")) {
    if (userId) {
      await deactivateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    const msg: TextMessage = {
      type: "text",
      text: "好的，已為你轉接闆娘本人～\n她會盡快回覆你喔！請稍等一下 😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId) logConversation(userId, "bot", msg.text, { action: "handoff" });
    console.log("LINE: Human handoff, bot paused for user", userId);
    return;
  }

  // "呼叫小螞蟻" → activate bot
  if (userMessage.includes("呼叫小螞蟻") || userMessage.includes("呼叫客服")) {
    if (userId) {
      await activateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    const greeting = await getConfig("greeting");
    const greetingText = greeting || "小螞蟻回來啦！🐜\n有什麼可以幫你的嗎？";
    const msg: TextMessage = {
      type: "text",
      text: greetingText,
      quickReply: getQuickReply(false),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId) logConversation(userId, "bot", greetingText, { action: "greeting" });
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
    if (userId) {
      await activateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    await sendPickupDateCarousel(event.replyToken, userId);
    if (userId) await touchBotActivity(userId);
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
    await deleteConfig(`pending_note:${userId}`);
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

  // Pending note: if user just made a reservation and types text, save as note
  // Placed AFTER all keyword checks to prevent keywords being saved as notes
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

  // Always-respond list: managed from admin settings (system_config)
  const autoRespondIds = ((await getConfig("auto_respond_user_ids")) || "").split(/[\n,]/).map((id) => id.trim()).filter(Boolean);
  const alwaysRespond = userId ? autoRespondIds.includes(userId) : false;

  // Bot is opt-in — only respond if user has activated it (always-respond list bypasses)
  if (!alwaysRespond && (!userId || !(await isUserActive(userId)))) {
    console.log("LINE: Bot inactive for user, skipping:", userId);
    return;
  }

  // Show typing indicator while AI generates response
  if (userId) {
    fetch("https://api.line.me/v2/bot/chat/loading/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ chatId: userId, loadingSeconds: 30 }),
    }).catch(() => {});
  }

  // Refresh stock from CYBERBIZ if stale and user is asking about availability
  if (isStockQuery(userMessage)) {
    await refreshStockIfStale();
  }

  // AI generation with timeout protection — send fallback if too slow
  let aiResponse;
  const aiStartTime = Date.now();
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), 25000)
    );
    // Fetch recent conversation for multi-turn context
    const recentHistory = userId ? await getConversationHistory(userId, 20) : [];
    const history = recentHistory.reverse().map((h) => ({ role: h.role, content: h.content }));

    aiResponse = await Promise.race([
      generateAIResponse(userMessage, history),
      timeoutPromise,
    ]);
  } catch (err: any) {
    console.error("LINE: AI generation failed:", err?.message);
    const fallbackText = "不好意思，小螞蟻現在腦袋轉不過來 😵‍💫\n請稍後再試一次，或直接點下方「呼叫闆娘」找真人幫你喔！";
    const msg: TextMessage = { type: "text", text: fallbackText, quickReply: getQuickReply(false) };
    if (userId) logConversation(userId, "bot", fallbackText, { error: true, reason: err?.message });
    try { await sendMessages(event.replyToken, userId, [msg]); } catch { /* reply token may be expired */ }
    return;
  }

  if (aiResponse.skip) {
    if (!alwaysRespond) {
      console.log("LINE: AI skipped message:", userMessage);
      return;
    }
    // Always-respond users: force a response even when AI wants to skip
    aiResponse.text = aiResponse.text || "（AI 判定為 SKIP，強制回覆模式）\n請換個方式提問試試～";
  }

  if (aiResponse.escalate) {
    const escalateText = aiResponse.text || "這個問題幫你轉接闆娘～她會盡快回覆你喔！😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！";
    const msg: TextMessage = {
      type: "text",
      text: escalateText,
      quickReply: getPausedQuickReply(),
    };
    if (userId) await deactivateUser(userId);
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId) logConversation(userId, "bot", escalateText, { action: "escalate", reason: aiResponse.escalateReason });
    console.log("LINE: AI escalated to human, reason:", aiResponse.escalateReason);
    return;
  }

  if (aiResponse.showPickupLink) {
    const pickupMessages = await buildPickupMessages(aiResponse.text || undefined);
    if (pickupMessages.length > 0) {
      await sendMessages(event.replyToken, userId, pickupMessages);
    }
    if (userId) logConversation(userId, "bot", aiResponse.text || "(取貨日期選擇)", { action: "pickup_carousel" });
    console.log("LINE: Pickup date carousel sent to user");
    return;
  }

  const hasProducts = aiResponse.productSpecs.length > 0;
  const maxTextSegments = hasProducts ? 2 : 3;
  const segments = splitResponse(aiResponse.text, maxTextSegments);

  const textMessages: TextMessage[] = segments.map((seg) => ({
    type: "text",
    text: seg,
  }));

  textMessages[textMessages.length - 1].quickReply = getQuickReply(hasProducts);

  const messages: Message[] = [...textMessages];

  if (hasProducts) {
    const carousel = await buildProductCarousel(aiResponse.productSpecs);
    if (carousel) messages.push(carousel);
  }

  // Log bot response before sending (so we capture it even if send fails)
  const aiLatencyMs = Date.now() - aiStartTime;
  if (userId) {
    const productIds = aiResponse.productSpecs.map((p: any) => p.id);
    logConversation(userId, "bot", aiResponse.text, { latencyMs: aiLatencyMs, ...(productIds.length > 0 ? { products: productIds } : {}) });
  }

  try {
    await sendMessages(event.replyToken, userId, messages);
  } catch (sendError) {
    console.error("LINE: Failed to send message:", sendError);
    // Log the failure for debugging
    if (userId) logConversation(userId, "bot", "[送出失敗] " + (sendError as Error)?.message, { error: true });
    return;
  }
  if (userId) await touchBotActivity(userId);
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

  // Feedback: customer marks a response as bad
  if (data === "FEEDBACK:BAD" && userId) {
    logConversation(userId, "user", "[回答不滿意]", { feedback: "bad", flagged: true });
    const msg: TextMessage = {
      type: "text",
      text: "感謝你的回饋！已記錄下來，闆娘會盡快改進 💪\n\n你可以直接點「呼叫闆娘」讓真人幫你解答喔！",
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

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

  // Customer cancels reservation (with ownership check)
  if (data.startsWith("CANCEL_MY_RES:") && userId) {
    const id = data.replace("CANCEL_MY_RES:", "").trim();
    const reservation = await getReservationById(id);
    if (!reservation || reservation.lineUserId !== userId) {
      const msg: TextMessage = { type: "text", text: "無法取消此預約 😅" };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    if (reservation.status === "cancelled") {
      const msg: TextMessage = { type: "text", text: "此預約已取消囉", quickReply: getPausedQuickReply() };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
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

  // Customer wants to rebook (modify = cancel + rebook, with ownership check)
  if (data.startsWith("REBOOK:") && userId) {
    const id = data.replace("REBOOK:", "").trim();
    const reservation = await getReservationById(id);
    if (!reservation || reservation.lineUserId !== userId) {
      const msg: TextMessage = { type: "text", text: "無法修改此預約 😅" };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    await updateReservationStatus(id, "cancelled");
    await sendPickupDateCarousel(event.replyToken, userId);
    await touchBotActivity(userId);
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
    const channelSecret = process.env.LINE_CHANNEL_SECRET || "";

    // Verify LINE signature — reject forged requests
    if (!signature || !channelSecret || !validateSignature(body, channelSecret, signature)) {
      console.log("LINE: Invalid or missing signature, rejecting");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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
