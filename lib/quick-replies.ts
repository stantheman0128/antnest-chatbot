import { QuickReply, QuickReplyItem } from "@line/bot-sdk";

const CALL_OWNER: QuickReplyItem = {
  type: "action",
  action: { type: "message", label: "👩 呼叫闆娘", text: "呼叫闆娘" },
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
    action: { type: "message", label: "🚚 運費", text: "運費怎麼算？" },
  },
  {
    type: "action",
    action: { type: "message", label: "💳 付款方式", text: "有哪些付款方式？" },
  },
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

/**
 * Get appropriate quick replies based on whether products were shown
 */
export function getQuickReply(hasProducts: boolean): QuickReply {
  return {
    items: hasProducts ? PRODUCT_FOLLOW_UP : COMMON_REPLIES,
  };
}
