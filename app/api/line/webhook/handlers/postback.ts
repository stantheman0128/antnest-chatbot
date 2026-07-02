import {
  createReservation,
  deleteConfig,
  getAvailabilityById,
  getReservationById,
  logConversation,
  setConfig,
  updateReservationStatus,
} from '@/lib/data-service';
import { PERIOD_INFO, buildTimeTypeChooser } from '@/lib/pickup-flex';
import { getPausedQuickReply, getQuickReply } from '@/lib/quick-replies';
import { Message, TextMessage, WebhookEvent } from '@line/bot-sdk';

import { getLineProfile, sendMessages, sendPickupDateCarousel, touchBotActivity } from './shared';

/** Handle SELECT_DATE postback — show time type chooser */
async function handleDateSelected(replyToken: string, userId: string, availabilityId: string) {
  const avail = await getAvailabilityById(availabilityId);
  if (!avail) {
    const msg: TextMessage = { type: 'text', text: '此日期已失效，請重新選擇 😅' };
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
  pickupTime: string,
) {
  const avail = await getAvailabilityById(availabilityId);
  if (!avail || avail.currentBookings >= avail.maxBookings) {
    const msg: TextMessage = {
      type: 'text',
      text: '抱歉，這個時段剛好預約滿了！請重新選擇 😅',
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const profile = await getLineProfile(userId);
  const displayName = profile?.displayName || 'LINE用戶';

  const reservation = await createReservation({
    availabilityId,
    lineUserId: userId,
    displayName,
    pickupTime,
    bookingType: 'exact',
  });

  if (!reservation) {
    const msg: TextMessage = { type: 'text', text: '預約失敗，請稍後再試' };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const dateLabel = avail.availableDate
    ? `${new Date(avail.availableDate + 'T00:00:00').getMonth() + 1}/${new Date(avail.availableDate + 'T00:00:00').getDate()}`
    : '';

  // Save pending note state
  await setConfig(`pending_note:${userId}`, reservation.id);

  const confirmMsg: TextMessage = {
    type: 'text',
    text: `預約成功！\n\n📅 ${dateLabel}\n⏰ ${pickupTime.slice(0, 5)}\n📍 新北市板橋區龍興街69號（浮洲火車站附近）\n\n如需修改請說「修改預約」😊`,
  };
  const notePrompt: TextMessage = {
    type: 'text',
    text: '要加備註嗎？如果可以的話附上訂單編號，老闆娘找訂單會比較方便喔！\n\n不需要的話按「跳過」就好～',
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'postback', label: '跳過', data: 'SKIP_NOTE', displayText: '跳過' },
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
  period: string,
) {
  const avail = await getAvailabilityById(availabilityId);
  if (!avail || avail.currentBookings >= avail.maxBookings) {
    const msg: TextMessage = {
      type: 'text',
      text: '抱歉，這個日期剛好預約滿了！請重新選擇 😅',
      quickReply: getQuickReply(false),
    };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const profile = await getLineProfile(userId);
  const displayName = profile?.displayName || 'LINE用戶';

  const periodInfo = PERIOD_INFO[period];
  const pickupTime = periodInfo?.start || '00:00';

  const reservation = await createReservation({
    availabilityId,
    lineUserId: userId,
    displayName,
    pickupTime,
    bookingType: 'flexible',
    flexiblePeriod: period,
  });

  if (!reservation) {
    const msg: TextMessage = { type: 'text', text: '預約失敗，請稍後再試' };
    await sendMessages(replyToken, userId, [msg]);
    return;
  }

  const dateLabel = avail.availableDate
    ? `${new Date(avail.availableDate + 'T00:00:00').getMonth() + 1}/${new Date(avail.availableDate + 'T00:00:00').getDate()}`
    : '';
  const periodLabel = periodInfo?.label || '時間待定';

  // Save pending note state
  await setConfig(`pending_note:${userId}`, reservation.id);

  const confirmMsg: TextMessage = {
    type: 'text',
    text: `預約成功！\n\n📅 ${dateLabel}\n🕐 ${periodLabel}\n📍 新北市板橋區龍興街69號（浮洲火車站附近）\n\n如需修改請說「修改預約」😊`,
  };
  const notePrompt: TextMessage = {
    type: 'text',
    text: '要加備註嗎？如果可以的話附上訂單編號，老闆娘找訂單會比較方便喔！\n\n不需要的話按「跳過」就好～',
    quickReply: {
      items: [
        {
          type: 'action',
          action: { type: 'postback', label: '跳過', data: 'SKIP_NOTE', displayText: '跳過' },
        },
      ],
    },
  };
  await sendMessages(replyToken, userId, [confirmMsg, notePrompt]);
  await touchBotActivity(userId);
}

export async function handlePostback(
  event: WebhookEvent & {
    type: 'postback';
    postback: { data: string; params?: { time?: string } };
    source: { userId?: string };
  },
) {
  const userId = event.source.userId;
  const data = event.postback.data;
  const time = event.postback.params?.time;

  // Feedback: customer marks a response as bad
  if (data === 'FEEDBACK:BAD' && userId) {
    void logConversation(userId, 'user', '[回答不滿意]', { feedback: 'bad', flagged: true });
    const msg: TextMessage = {
      type: 'text',
      text: '感謝你的回饋！已記錄下來，闆娘會盡快改進 💪\n\n你可以直接點「呼叫闆娘」讓真人幫你解答喔！',
      quickReply: getQuickReply(false, true),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // Customer selects a date → show time type chooser
  if (data.startsWith('SELECT_DATE:') && userId) {
    const availabilityId = data.replace('SELECT_DATE:', '').trim();
    await handleDateSelected(event.replyToken, userId, availabilityId);
    return;
  }

  // Customer selects exact time via DateTimePicker
  if (data.startsWith('PICK_TIME_EXACT:') && userId && time) {
    const availabilityId = data.replace('PICK_TIME_EXACT:', '').trim();
    await handleExactTimeSelected(event.replyToken, userId, availabilityId, time);
    return;
  }

  // Customer selects a flexible period
  if (data.startsWith('PICK_PERIOD:') && userId) {
    const parts = data.replace('PICK_PERIOD:', '').split(':');
    const availabilityId = parts[0]?.trim();
    const period = parts[1]?.trim();
    if (availabilityId && period) {
      await handleFlexiblePeriodSelected(event.replyToken, userId, availabilityId, period);
    }
    return;
  }

  // Legacy: old PICK_TIME postback (from old Flex messages still in chat history)
  if (data.startsWith('PICK_TIME:') && userId && time) {
    const availabilityId = data.replace('PICK_TIME:', '').trim();
    await handleExactTimeSelected(event.replyToken, userId, availabilityId, time);
    return;
  }

  // Customer cancels reservation (with ownership check)
  if (data.startsWith('CANCEL_MY_RES:') && userId) {
    const id = data.replace('CANCEL_MY_RES:', '').trim();
    const reservation = await getReservationById(id);
    if (!reservation || reservation.lineUserId !== userId) {
      const msg: TextMessage = { type: 'text', text: '無法取消此預約 😅' };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    if (reservation.status === 'cancelled') {
      const msg: TextMessage = {
        type: 'text',
        text: '此預約已取消囉',
        quickReply: getPausedQuickReply(),
      };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    await updateReservationStatus(id, 'cancelled');
    const msg: TextMessage = {
      type: 'text',
      text: '已取消你的預約 ✅\n\n如需重新預約，請點「我要預約取貨」😊',
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    console.log('LINE: Customer cancelled reservation', id);
    return;
  }

  // Customer wants to rebook (modify = cancel + rebook, with ownership check)
  if (data.startsWith('REBOOK:') && userId) {
    const id = data.replace('REBOOK:', '').trim();
    const reservation = await getReservationById(id);
    if (!reservation || reservation.lineUserId !== userId) {
      const msg: TextMessage = { type: 'text', text: '無法修改此預約 😅' };
      await sendMessages(event.replyToken, userId, [msg]);
      return;
    }
    await updateReservationStatus(id, 'cancelled');
    await sendPickupDateCarousel(event.replyToken, userId);
    await touchBotActivity(userId);
    console.log('LINE: Customer rebooking after cancelling', id);
    return;
  }

  // Customer skips note after reservation
  if (data === 'SKIP_NOTE' && userId) {
    await deleteConfig(`pending_note:${userId}`);
    const msg: TextMessage = {
      type: 'text',
      text: '好的！',
      quickReply: getPausedQuickReply(),
    };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  // Legacy: old CONFIRM_RES/REJECT_RES from chat history
  if (data.startsWith('CONFIRM_RES:') || data.startsWith('REJECT_RES:')) {
    const msg: TextMessage = { type: 'text', text: '此功能已更新，請至後台管理預約 🙂' };
    await sendMessages(event.replyToken, userId, [msg]);
    return;
  }

  console.log('LINE: Unhandled postback data:', data);
}
