import type { PickupAvailability, Reservation } from "./data-service";

const WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = WEEKDAY_ZH[d.getDay()];
  return `${m}月${day}日（週${w}）`;
}

/** Period metadata for flexible bookings */
export const PERIOD_INFO: Record<string, { start: string; end: string; label: string }> = {
  afternoon:     { start: "14:00", end: "17:00", label: "下午（2-5點）" },
  evening_early: { start: "17:00", end: "19:00", label: "傍晚（5-7點）" },
  night:         { start: "19:00", end: "21:00", label: "晚上（7點後）" },
  tbd:           { start: "00:00", end: "23:59", label: "之後再說" },
};

/**
 * Build a LINE Flex Carousel for pickup date selection.
 * Each card has a postback button SELECT_DATE:{availabilityId}.
 */
export function buildPickupDateCarousel(availabilities: PickupAvailability[]) {
  if (availabilities.length === 0) return null;

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
              type: "postback",
              label: "選擇此日期",
              data: `SELECT_DATE:${avail.id}`,
              displayText: `選擇 ${dateLabel}`,
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
    altText: "請選擇取貨日期",
    contents: {
      type: "carousel",
      contents: items,
    },
  };
}

/**
 * Build "你的取貨時間確定了嗎？" Flex.
 * Path A: DateTimePicker for exact time.
 * Path B: 4 period buttons for flexible booking.
 */
export function buildTimeTypeChooser(avail: PickupAvailability) {
  const dateLabel = formatDateLabel(avail.availableDate);

  return {
    type: "flex",
    altText: `${dateLabel} — 選擇取貨時間`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: dateLabel, weight: "bold", size: "md", color: "#ffffff", align: "center" },
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
            text: "你的取貨時間確定了嗎？",
            size: "sm",
            weight: "bold",
            color: "#1c1917",
            align: "center",
          },
          {
            type: "button",
            action: {
              type: "datetimepicker",
              label: "我知道幾點取",
              data: `PICK_TIME_EXACT:${avail.id}`,
              mode: "time",
              initial: avail.startTime.slice(0, 5),
              min: avail.startTime.slice(0, 5),
              max: avail.endTime.slice(0, 5),
            },
            style: "primary",
            color: "#92400e",
            height: "sm",
            margin: "md",
          },
          {
            type: "separator",
            margin: "lg",
          },
          {
            type: "text",
            text: "或選擇大約時段",
            size: "xs",
            color: "#78716c",
            align: "center",
            margin: "lg",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "下午",
                  data: `PICK_PERIOD:${avail.id}:afternoon`,
                  displayText: "下午（2-5點）",
                },
                style: "secondary",
                height: "sm",
                flex: 1,
              },
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "傍晚",
                  data: `PICK_PERIOD:${avail.id}:evening_early`,
                  displayText: "傍晚（5-7點）",
                },
                style: "secondary",
                height: "sm",
                flex: 1,
              },
            ],
            spacing: "sm",
            margin: "sm",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "晚上",
                  data: `PICK_PERIOD:${avail.id}:night`,
                  displayText: "晚上（7點後）",
                },
                style: "secondary",
                height: "sm",
                flex: 1,
              },
              {
                type: "button",
                action: {
                  type: "postback",
                  label: "之後再說",
                  data: `PICK_PERIOD:${avail.id}:tbd`,
                  displayText: "時間之後再說",
                },
                style: "secondary",
                height: "sm",
                flex: 1,
              },
            ],
            spacing: "sm",
            margin: "sm",
          },
        ],
        paddingAll: "16px",
      },
    },
  };
}

/** Flex Bubble shown to customer for their reservation, with cancel/rebook buttons. */
export function buildCustomerReservationFlex(reservation: Reservation) {
  const dateLabel = reservation.availableDate
    ? formatDateLabel(reservation.availableDate)
    : "（未知日期）";

  // Display time based on booking type
  let timeLabel: string;
  if (reservation.bookingType === "flexible" && reservation.flexiblePeriod) {
    timeLabel = PERIOD_INFO[reservation.flexiblePeriod]?.label || "時間待定";
  } else {
    timeLabel = reservation.pickupTime?.slice(0, 5) || "";
  }

  const statusText: Record<string, string> = {
    pending: "⏳ 待確認",
    confirmed: "已確認",
    cancelled: "已取消",
    completed: "已完成",
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
            action: { type: "postback", label: "修改時間", data: `REBOOK:${reservation.id}` },
            style: "secondary",
            height: "sm",
          },
          {
            type: "button",
            action: { type: "postback", label: "取消預約", data: `CANCEL_MY_RES:${reservation.id}` },
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

/** Google Calendar "add event" URL (kept for backward compat). */
export function buildGoogleCalendarUrl(reservation: Reservation): string {
  if (!reservation.availableDate || !reservation.pickupTime) return "";

  const [year, month, day] = reservation.availableDate.split("-").map(Number);
  const [hour, min] = reservation.pickupTime.split(":").map(Number);

  function pad(n: number) { return String(n).padStart(2, "0"); }
  const startStr = `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(min)}00`;
  const endHour = hour + 1;
  const endStr = `${year}${pad(month)}${pad(day)}T${pad(endHour)}${pad(min)}00`;

  const details = encodeURIComponent(`顧客：${reservation.displayName}${reservation.orderNumber ? `\n訂單：${reservation.orderNumber}` : ""}`);
  const text = encodeURIComponent("螞蟻窩取貨預約");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startStr}/${endStr}&ctz=Asia/Taipei&details=${details}`;
}
