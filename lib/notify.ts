import { Client } from "@line/bot-sdk";
import type { Reservation } from "./data-service";
import { buildOwnerNotificationFlex } from "./pickup-flex";

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

/** Push owner a Flex notification with confirm/reject/calendar buttons. */
export async function notifyOwnerNewReservation(reservation: Reservation): Promise<void> {
  const ownerId = process.env.OWNER_LINE_USER_ID;
  if (!ownerId) return;

  const flex = buildOwnerNotificationFlex(reservation);
  try {
    await getLineClient().pushMessage(ownerId, flex as any);
  } catch (e) {
    console.error("Failed to notify owner:", e);
  }
}

/** Push customer: owner confirmed their booking. */
export async function notifyCustomerConfirmed(
  lineUserId: string,
  reservation: Reservation
): Promise<void> {
  const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
  let dateStr = "";
  if (reservation.availableDate) {
    const d = new Date(reservation.availableDate + "T00:00:00");
    dateStr = `${d.getMonth() + 1}月${d.getDate()}日（週${WEEKDAY_ZH[d.getDay()]}）`;
  }
  const timeStr = reservation.pickupTime?.slice(0, 5) || "";

  try {
    await getLineClient().pushMessage(lineUserId, {
      type: "text",
      text: `✅ 板娘已確認你的預約！\n\n📅 ${dateStr}\n⏰ ${timeStr}\n\n有問題請聯繫闆娘 😊`,
    });
  } catch (e) {
    console.error("Failed to notify customer confirmed:", e);
  }
}

/** Push customer: owner rejected their booking, invite to rebook. */
export async function notifyCustomerRejected(lineUserId: string): Promise<void> {
  try {
    await getLineClient().pushMessage(lineUserId, {
      type: "text",
      text: "很抱歉，板娘這個時段無法接待 😢\n請點下方按鈕重新選擇時段，或直接聯繫闆娘",
      quickReply: {
        items: [
          {
            type: "action",
            action: { type: "message", label: "📅 重新選擇時段", text: "我要預約取貨" },
          },
          {
            type: "action",
            action: { type: "message", label: "👩 呼叫闆娘", text: "呼叫闆娘" },
          },
        ],
      },
    } as any);
  } catch (e) {
    console.error("Failed to notify customer rejected:", e);
  }
}

/** Push owner: customer cancelled their reservation. */
export async function notifyOwnerCancelledByCustomer(reservation: Reservation): Promise<void> {
  const ownerId = process.env.OWNER_LINE_USER_ID;
  if (!ownerId) return;

  const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
  let dateStr = "";
  if (reservation.availableDate) {
    const d = new Date(reservation.availableDate + "T00:00:00");
    dateStr = `${d.getMonth() + 1}/${d.getDate()}（週${WEEKDAY_ZH[d.getDay()]}）`;
  }
  const timeStr = reservation.pickupTime?.slice(0, 5) || "";

  try {
    await getLineClient().pushMessage(ownerId, {
      type: "text",
      text: `🔔 顧客取消預約\n\n👤 ${reservation.displayName}\n📅 ${dateStr} ⏰ ${timeStr}`,
    });
  } catch (e) {
    console.error("Failed to notify owner of cancellation:", e);
  }
}
