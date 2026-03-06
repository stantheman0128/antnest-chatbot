import type { PickupAvailability, Reservation } from "./data-service";

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${m}月${day}日（週${w}）`;
}

/**
 * Build a LINE Flex Message Carousel for pickup date selection.
 * Each card represents one available date, with a DateTimePicker button
 * so the customer picks their exact time within the allowed window.
 *
 * DateTimePicker postback data format: "PICK_TIME:{availabilityId}"
 */
export function buildPickupDateCarousel(availabilities: PickupAvailability[]) {
  if (availabilities.length === 0) return null;

  // LINE carousel max 12 bubbles
  const items = availabilities.slice(0, 12).map((avail) => {
    const dateLabel = formatDateLabel(avail.availableDate);
    const timeRange = `${avail.startTime.slice(0, 5)}–${avail.endTime.slice(0, 5)}`;

    return {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: dateLabel,
            weight: "bold",
            size: "md",
            color: "#ffffff",
            align: "center",
          },
        ],
        backgroundColor: "#92400e",
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "可取貨時間",
            size: "xs",
            color: "#92400e",
            align: "center",
          },
          {
            type: "text",
            text: timeRange,
            size: "lg",
            weight: "bold",
            color: "#1c1917",
            align: "center",
            margin: "sm",
          },
        ],
        paddingAll: "14px",
        spacing: "none",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "datetimepicker",
              label: "選擇取貨時間",
              data: `PICK_TIME:${avail.id}`,
              mode: "time",
              initial: avail.startTime.slice(0, 5),
              min: avail.startTime.slice(0, 5),
              max: avail.endTime.slice(0, 5),
            },
            style: "primary",
            color: "#92400e",
            height: "sm",
          },
        ],
        paddingAll: "12px",
      },
    };
  });

  return {
    type: "flex",
    altText: "請選擇取貨日期與時間",
    contents: {
      type: "carousel",
      contents: items,
    },
  };
}

/** Google Calendar "add event" URL for a reservation. */
export function buildGoogleCalendarUrl(reservation: Reservation): string {
  if (!reservation.availableDate || !reservation.pickupTime) return "";

  // Parse local Taiwan time → format YYYYMMDDTHHmmss
  const [year, month, day] = reservation.availableDate.split("-").map(Number);
  const [hour, min] = reservation.pickupTime.split(":").map(Number);

  function pad(n: number) { return String(n).padStart(2, "0"); }
  const startStr = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(min)}00`;

  // End = start + 1 hour
  const endHour = hour + 1;
  const endStr = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(min)}00`;

  const dateLabel = formatDateLabel(reservation.availableDate);
  const details = encodeURIComponent(`顧客：${reservation.displayName}${reservation.orderNumber ? `\n訂單：${reservation.orderNumber}` : ""}`);
  const text = encodeURIComponent("螞蟻窩取貨預約");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&ctz=Asia/Taipei&details=${details}&location=${encodeURIComponent(dateLabel)}`;
}

/** Flex Bubble sent to owner for a new reservation — with confirm/reject/calendar buttons. */
export function buildOwnerNotificationFlex(reservation: Reservation) {
  const dateLabel = reservation.availableDate
    ? formatDateLabel(reservation.availableDate)
    : "（未知日期）";
  const timeLabel = reservation.pickupTime?.slice(0, 5) || "（未知時間）";
  const calUrl = buildGoogleCalendarUrl(reservation);

  const bodyContents: any[] = [
    { type: "text", text: `👤 ${reservation.displayName}`, size: "md", weight: "bold", color: "#1c1917" },
  ];
  if (reservation.lineUserId) {
    bodyContents.push({ type: "text", text: `🔑 ${reservation.lineUserId}`, size: "xs", color: "#78716c", wrap: true });
  }
  bodyContents.push(
    { type: "text", text: `📅 ${dateLabel}`, size: "sm", color: "#44403c", margin: "md" },
    { type: "text", text: `⏰ ${timeLabel}`, size: "sm", color: "#44403c" },
  );
  if (reservation.orderNumber) {
    bodyContents.push({ type: "text", text: `🧾 ${reservation.orderNumber}`, size: "sm", color: "#44403c" });
  }
  if (reservation.note) {
    bodyContents.push({ type: "text", text: `💬 ${reservation.note}`, size: "sm", color: "#78716c", wrap: true });
  }

  const footerContents: any[] = [
    {
      type: "button",
      action: { type: "postback", label: "✅ 確認", data: `CONFIRM_RES:${reservation.id}` },
      style: "primary",
      color: "#92400e",
      height: "sm",
    },
    {
      type: "button",
      action: { type: "postback", label: "❌ 拒絕", data: `REJECT_RES:${reservation.id}` },
      style: "secondary",
      height: "sm",
    },
  ];
  if (calUrl) {
    footerContents.push({
      type: "button",
      action: { type: "uri", label: "📅 加入行事曆", uri: calUrl },
      style: "secondary",
      height: "sm",
    });
  }

  return {
    type: "flex",
    altText: `📦 新預約申請：${reservation.displayName} ${dateLabel} ${timeLabel}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📦 新預約申請", weight: "bold", size: "md", color: "#ffffff" },
        ],
        backgroundColor: "#92400e",
        paddingAll: "14px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: bodyContents,
        paddingAll: "16px",
        spacing: "sm",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: footerContents,
        spacing: "sm",
        paddingAll: "12px",
      },
    },
  };
}

/** Flex Bubble shown to customer for their latest reservation, with cancel/rebook buttons. */
export function buildCustomerReservationFlex(reservation: Reservation) {
  const dateLabel = reservation.availableDate
    ? formatDateLabel(reservation.availableDate)
    : "（未知日期）";
  const timeLabel = reservation.pickupTime?.slice(0, 5) || "";

  const statusText: Record<string, string> = {
    pending: "⏳ 待板娘確認",
    confirmed: "✅ 已確認",
    cancelled: "❌ 已取消",
    completed: "🏁 已完成",
  };

  return {
    type: "flex",
    altText: `你的預約：${dateLabel} ${timeLabel}`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "你的預約", weight: "bold", size: "md", color: "#ffffff" },
        ],
        backgroundColor: "#92400e",
        paddingAll: "14px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: `📅 ${dateLabel}`, size: "md", weight: "bold", color: "#1c1917" },
          { type: "text", text: `⏰ ${timeLabel}`, size: "sm", color: "#44403c", margin: "sm" },
          { type: "text", text: statusText[reservation.status] || reservation.status, size: "sm", color: "#78716c", margin: "sm" },
        ],
        paddingAll: "16px",
        spacing: "sm",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: { type: "postback", label: "🔄 修改時間", data: `REBOOK:${reservation.id}` },
            style: "secondary",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "❌ 取消預約", data: `CANCEL_MY_RES:${reservation.id}` },
            style: "secondary",
            height: "sm",
          },
        ],
        spacing: "sm",
        paddingAll: "12px",
      },
    },
  };
}
