import type { PickupAvailability } from "./data-service";

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
