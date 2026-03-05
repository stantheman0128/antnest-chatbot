import { Client } from "@line/bot-sdk";
import type { Reservation } from "./data-service";

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

function getLineClient() {
  return new Client({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
    channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  });
}

export async function notifyOwnerNewReservation(
  reservation: Reservation
): Promise<void> {
  const ownerId = process.env.OWNER_LINE_USER_ID;
  if (!ownerId) return;

  const date = reservation.slotDate
    ? new Date(reservation.slotDate + "T00:00:00")
    : null;
  const weekday = date ? WEEKDAY_ZH[date.getDay()] : "";
  const dateStr = date
    ? `${date.getMonth() + 1}/${date.getDate()}（週${weekday}）`
    : "";
  const timeStr = reservation.slotStartTime
    ? `${reservation.slotStartTime}–${reservation.slotEndTime}`
    : "";

  const lines = [
    "📦 新的取貨預約！",
    "",
    `👤 ${reservation.displayName}`,
    reservation.lineUserId ? `🔑 LINE ID：${reservation.lineUserId}` : null,
    reservation.orderNumber ? `🧾 訂單：${reservation.orderNumber}` : null,
    `📅 時間：${dateStr} ${timeStr}`,
    reservation.note ? `💬 備註：${reservation.note}` : null,
    "",
    "在後台管理預約：\n" + (process.env.NEXT_PUBLIC_BASE_URL || "") + "/admin/pickup",
  ].filter(Boolean).join("\n");

  try {
    await getLineClient().pushMessage(ownerId, {
      type: "text",
      text: lines,
    });
  } catch (e) {
    console.error("Failed to notify owner:", e);
  }
}
