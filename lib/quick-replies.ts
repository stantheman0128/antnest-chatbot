import { QuickReply, QuickReplyItem } from "@line/bot-sdk";

const CALL_OWNER: QuickReplyItem = {
  type: "action",
  action: { type: "message", label: "👩 呼叫闆娘", text: "呼叫闆娘" },
};

const FEEDBACK: QuickReplyItem = {
  type: "action",
  action: { type: "postback", label: "沒有解答到嗎？", data: "FEEDBACK:BAD", displayText: "這個回答沒有解答到我的問題" },
};

const COMMON_REPLIES: QuickReplyItem[] = [
  {
    type: "action",
    action: { type: "message", label: "🍰 查看品項", text: "有什麼甜點？" },
  },
  {
    type: "action",
    action: { type: "message", label: "🛒 我要訂購", text: "怎麼訂購？" },
  },
  {
    type: "action",
    action: { type: "message", label: "📅 我要預約取貨", text: "我要預約取貨" },
  },
  FEEDBACK,
  CALL_OWNER,
];

const PRODUCT_FOLLOW_UP: QuickReplyItem[] = [
  {
    type: "action",
    action: { type: "message", label: "🍴 怎麼吃最好吃", text: "食用方式建議" },
  },
  {
    type: "action",
    action: { type: "message", label: "🧊 怎麼保存", text: "保存方式跟期限" },
  },
  {
    type: "action",
    action: { type: "message", label: "🛒 我要訂購", text: "怎麼訂購？" },
  },
  CALL_OWNER,
];

const PAUSED_REPLIES: QuickReplyItem[] = [
  {
    type: "action",
    action: { type: "message", label: "🐜 呼叫小螞蟻", text: "呼叫小螞蟻" },
  },
  {
    type: "action",
    action: { type: "message", label: "📅 我要預約取貨", text: "我要預約取貨" },
  },
];

/**
 * Get appropriate quick replies based on context.
 * If mentionsOwner is true, "呼叫闆娘" button is moved to the front.
 */
export function getQuickReply(hasProducts: boolean, mentionsOwner = false): QuickReply {
  const items = hasProducts ? [...PRODUCT_FOLLOW_UP] : [...COMMON_REPLIES];
  if (mentionsOwner) {
    const idx = items.findIndex((it) => it.action && "text" in it.action && it.action.text === "呼叫闆娘");
    if (idx > 0) {
      const [owner] = items.splice(idx, 1);
      items.unshift(owner);
    }
  }
  return { items };
}

export function getPausedQuickReply(): QuickReply {
  return { items: PAUSED_REPLIES };
}
