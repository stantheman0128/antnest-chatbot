import {
  STRONG_MODEL_DEFAULT,
  classifyIntent,
  generateAIResponse,
  splitResponse,
} from '@/lib/ai-client';
import {
  deleteConfig,
  getConfig,
  getConversationHistory,
  getLatestReservationByUser,
  logConversation,
  updateReservationNote,
  upsertLineUser,
} from '@/lib/data-service';
import { buildProductCarousel } from '@/lib/flex-message';
import { buildCustomerReservationFlex } from '@/lib/pickup-flex';
import { getPausedQuickReply, getQuickReply } from '@/lib/quick-replies';
import { isStockQuery, refreshStockIfStale } from '@/lib/stock-checker';
import { Message, TextMessage, WebhookEvent } from '@line/bot-sdk';

import {
  activateUser,
  buildPickupMessages,
  deactivateUser,
  getLineProfile,
  isUserActive,
  sendMessages,
  sendPickupDateCarousel,
  touchBotActivity,
} from './shared';

export async function handleTextMessage(
  event: WebhookEvent & {
    type: 'message';
    message: { type: 'text'; text: string };
    source: { userId?: string };
  },
) {
  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log('LINE message received:', userMessage);

  // Log user + message (fire-and-forget)
  if (userId) {
    void getLineProfile(userId)
      .then((profile) => {
        void upsertLineUser(userId, profile?.displayName || 'LINE用戶', profile?.pictureUrl);
      })
      .catch(() => {});
    void logConversation(userId, 'user', userMessage);
  }

  // Guard: ignore absurdly long messages (likely spam or attack)
  if (userMessage.length > 2000) {
    console.log('LINE: Ignoring message exceeding 2000 chars, length:', userMessage.length);
    return;
  }

  // "呼叫闆娘" → deactivate bot, hand off to human
  if (userMessage.includes('呼叫闆娘')) {
    if (userId) {
      await deactivateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    const msg: TextMessage = {
      type: 'text',
      text: '好的，已為你轉接闆娘本人～\n她會盡快回覆你喔！請稍等一下 😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！',
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId) void logConversation(userId, 'bot', msg.text, { action: 'handoff' });
    console.log('LINE: Human handoff, bot paused for user', userId);
    return;
  }

  // "呼叫小螞蟻" → activate bot
  if (userMessage.includes('呼叫小螞蟻') || userMessage.includes('呼叫客服')) {
    if (userId) {
      await activateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    const greeting = await getConfig('greeting');
    const greetingText = greeting || '小螞蟻回來啦！🐜\n有什麼可以幫你的嗎？';
    const msg: TextMessage = {
      type: 'text',
      text: greetingText,
      quickReply: getQuickReply(false),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId) void logConversation(userId, 'bot', greetingText, { action: 'greeting' });
    console.log('LINE: Bot resumed for user', userId);
    return;
  }

  // 預約取貨關鍵字 → bypass AI, show date carousel directly
  if (
    userMessage.includes('我要預約取貨') ||
    userMessage.includes('我要預約') ||
    userMessage.includes('預約取貨') ||
    userMessage.includes('約取貨') ||
    userMessage.includes('我要約取貨')
  ) {
    if (userId) {
      await activateUser(userId);
      await deleteConfig(`pending_note:${userId}`);
    }
    await sendPickupDateCarousel(event.replyToken, userId);
    if (userId) await touchBotActivity(userId);
    console.log('LINE: Pickup carousel triggered by keyword:', userMessage);
    return;
  }

  // 查詢/取消/修改預約 → bypass active check
  if (
    userId &&
    (userMessage.includes('取消預約') ||
      userMessage.includes('修改預約') ||
      userMessage.includes('我的預約') ||
      userMessage.includes('查看預約') ||
      userMessage.includes('改預約'))
  ) {
    await deleteConfig(`pending_note:${userId}`);
    const reservation = await getLatestReservationByUser(userId);
    if (!reservation) {
      const msg: TextMessage = {
        type: 'text',
        text: '查無預約紀錄喔！\n如需預約請點下方「我要預約取貨」😊',
        quickReply: getPausedQuickReply(),
      };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    const flex = buildCustomerReservationFlex(reservation);
    await sendMessages(event.replyToken, userId, [flex as Message]);
    return;
  }

  // 下次開單 / 補貨 → reply with configured announcement
  if (
    userMessage.includes('下次開單') ||
    userMessage.includes('開單時間') ||
    userMessage.includes('補貨') ||
    userMessage.includes('什麼時候有貨') ||
    userMessage.includes('什麼時候可以買') ||
    userMessage.includes('什麼時候能買') ||
    userMessage.includes('什麼時候開放') ||
    userMessage.includes('何時補') ||
    userMessage.includes('還有貨嗎') ||
    userMessage.includes('有沒有貨')
  ) {
    const announcement = await getConfig('next_order_announcement');
    const msg: TextMessage = {
      type: 'text',
      text: announcement || '目前還沒有下次開單的資訊喔～\n請追蹤我們的官方帳號以獲取最新消息 😊',
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId)
      void logConversation(userId, 'bot', msg.text, { action: 'next_order_announcement' });
    return;
  }

  // "我的ID" → reply with LINE User ID
  if (userMessage.trim() === '我的ID' || userMessage.trim() === '我的id') {
    const msg: TextMessage = {
      type: 'text',
      text: `你的 LINE User ID：\n${userId || '（無法取得）'}`,
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // 回饋/建議 → same as FEEDBACK:BAD postback
  if (
    userMessage.includes('回饋') ||
    userMessage.includes('建議') ||
    userMessage.includes('意見') ||
    userMessage.includes('不滿意')
  ) {
    if (userId)
      void logConversation(userId, 'user', `[回饋] ${userMessage}`, {
        feedback: 'bad',
        flagged: true,
      });
    const msg: TextMessage = {
      type: 'text',
      text: '謝謝你願意給我們回饋！已記錄下來，闆娘會盡快查看 💗\n\n如果需要闆娘親自處理，可以點下方「呼叫闆娘」喔！',
      quickReply: getQuickReply(false, true),
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
        type: 'text',
        text: '已加入備註！',
        quickReply: getPausedQuickReply(),
      };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
  }

  // Always-respond list: managed from admin settings (system_config)
  const autoRespondIds = ((await getConfig('auto_respond_user_ids')) || '')
    .split(/[\n,]/)
    .map((id) => id.trim())
    .filter(Boolean);
  const alwaysRespond = userId ? autoRespondIds.includes(userId) : false;

  // Bot is opt-in — only respond if user has activated it (always-respond list bypasses)
  if (!alwaysRespond && (!userId || !(await isUserActive(userId)))) {
    console.log('LINE: Bot inactive for user, skipping:', userId);
    return;
  }

  // Show typing indicator while AI generates response
  if (userId) {
    fetch('https://api.line.me/v2/bot/chat/loading/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ chatId: userId, loadingSeconds: 30 }),
    }).catch(() => {});
  }

  // ── Tier 1.5: Intent Classification ──────────────────
  const classification = await classifyIntent(userMessage);
  const { topic: classifiedTopic, confidence: classificationConfidence } = classification;
  console.log(
    `LINE: classified="${classifiedTopic}" confidence=${classificationConfidence} latency=${classification.latencyMs}ms msg="${userMessage.slice(0, 50)}"`,
  );

  // Direct-response: 開單補貨 → return config value, no AI needed
  if (classifiedTopic === '開單補貨' && classificationConfidence === 'high') {
    const announcement = await getConfig('next_order_announcement');
    const msg: TextMessage = {
      type: 'text',
      text: announcement || '目前還沒有下次開單的資訊喔～\n請追蹤我們的官方帳號以獲取最新消息 😊',
      quickReply: getQuickReply(false),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId)
      void logConversation(userId, 'bot', msg.text, {
        action: 'classified_direct',
        classifiedTopic,
        classificationLatencyMs: classification.latencyMs,
      });
    return;
  }

  // Direct-response: 預約取貨 → show pickup carousel, no AI needed
  if (classifiedTopic === '預約取貨' && classificationConfidence === 'high') {
    await sendPickupDateCarousel(event.replyToken, userId);
    if (userId) await touchBotActivity(userId);
    if (userId)
      void logConversation(userId, 'bot', '(預約取貨 carousel via classification)', {
        action: 'pickup_carousel',
        classifiedTopic,
        classificationLatencyMs: classification.latencyMs,
      });
    return;
  }

  // Determine model: known topics → default (Flash-Lite), '其他' → strong model
  const knownTopics = [
    '商品介紹',
    '價格',
    '運費物流',
    '付款方式',
    '訂購流程',
    '保存食用',
    '退換貨',
    '會員優惠',
    '品牌資訊',
    '閒聊問候',
  ];
  const useStrongModel = !knownTopics.includes(classifiedTopic);
  const strongModelId = useStrongModel
    ? (await getConfig('strong_ai_model')) || STRONG_MODEL_DEFAULT
    : undefined;

  // Refresh stock from CYBERBIZ if stale and user is asking about availability
  if (isStockQuery(userMessage)) {
    await refreshStockIfStale();
  }

  // AI generation with timeout protection — send fallback if too slow
  let aiResponse;
  const aiStartTime = Date.now();
  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI_TIMEOUT')), 25000),
    );
    // Fetch recent conversation for multi-turn context
    const recentHistory = userId ? await getConversationHistory(userId, 20) : [];
    const history = recentHistory.reverse().map((h) => ({ role: h.role, content: h.content }));

    aiResponse = await Promise.race([
      generateAIResponse(userMessage, history, strongModelId),
      timeoutPromise,
    ]);
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.error('LINE: AI generation failed:', errMessage);
    const fallbackText =
      '不好意思，小螞蟻現在腦袋轉不過來 😵‍💫\n請稍後再試一次，或直接點下方「呼叫闆娘」找真人幫你喔！';
    const msg: TextMessage = { type: 'text', text: fallbackText, quickReply: getQuickReply(false) };
    if (userId)
      void logConversation(userId, 'bot', fallbackText, { error: true, reason: errMessage });
    try {
      await sendMessages(event.replyToken, userId, [msg]);
    } catch {
      /* reply token may be expired */
    }
    return;
  }

  if (aiResponse.skip) {
    if (!alwaysRespond) {
      console.log('LINE: AI skipped message:', userMessage);
      return;
    }
    // Always-respond users: force a response even when AI wants to skip
    aiResponse.text = aiResponse.text || '（AI 判定為 SKIP，強制回覆模式）\n請換個方式提問試試～';
  }

  if (aiResponse.escalate) {
    const escalateText =
      aiResponse.text ||
      '這個問題幫你轉接闆娘～她會盡快回覆你喔！😊\n\n如果之後想問商品、價格、運費等問題，按下方「呼叫小螞蟻🐜」就有 AI 小幫手幫你解答喔！';
    const msg: TextMessage = {
      type: 'text',
      text: escalateText,
      quickReply: getPausedQuickReply(),
    };
    if (userId) await deactivateUser(userId);
    await sendMessages(event.replyToken, userId, [msg]);
    if (userId)
      void logConversation(userId, 'bot', escalateText, {
        action: 'escalate',
        reason: aiResponse.escalateReason,
      });
    console.log('LINE: AI escalated to human, reason:', aiResponse.escalateReason);
    return;
  }

  if (aiResponse.showPickupLink) {
    const pickupMessages = await buildPickupMessages(aiResponse.text || undefined);
    if (pickupMessages.length > 0) {
      await sendMessages(event.replyToken, userId, pickupMessages);
    }
    if (userId)
      void logConversation(userId, 'bot', aiResponse.text || '(取貨日期選擇)', {
        action: 'pickup_carousel',
      });
    console.log('LINE: Pickup date carousel sent to user');
    return;
  }

  const hasProducts = aiResponse.productSpecs.length > 0;
  const mentionsOwner = aiResponse.text.includes('呼叫闆娘');
  const maxTextSegments = hasProducts ? 2 : 3;
  const segments = splitResponse(aiResponse.text, maxTextSegments);

  const textMessages: TextMessage[] = segments.map((seg) => ({
    type: 'text',
    text: seg,
  }));

  textMessages[textMessages.length - 1].quickReply = getQuickReply(hasProducts, mentionsOwner);

  const messages: Message[] = [...textMessages];

  if (hasProducts) {
    const carousel = await buildProductCarousel(aiResponse.productSpecs);
    if (carousel) messages.push(carousel);
  }

  // Log bot response before sending (so we capture it even if send fails)
  const aiLatencyMs = Date.now() - aiStartTime;
  if (userId) {
    const productIds = aiResponse.productSpecs.map((p) => p.id);
    void logConversation(userId, 'bot', aiResponse.text, {
      latencyMs: aiLatencyMs,
      classifiedTopic,
      classificationConfidence,
      classificationLatencyMs: classification.latencyMs,
      modelUsed: useStrongModel ? 'strong' : 'primary',
      ...(productIds.length > 0 ? { products: productIds } : {}),
    });
  }

  try {
    await sendMessages(event.replyToken, userId, messages);
  } catch (sendError) {
    console.error('LINE: Failed to send message:', sendError);
    // Log the failure for debugging
    const errMsg = sendError instanceof Error ? sendError.message : String(sendError);
    if (userId)
      void logConversation(userId, 'bot', '[送出失敗] ' + errMsg, {
        error: true,
      });
    return;
  }
  if (userId) await touchBotActivity(userId);
}
