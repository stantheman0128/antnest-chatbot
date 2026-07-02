export interface ConfigItem {
  key: string;
  value: string;
  label: string;
  description: string;
}

export interface LineUserInfo {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
}

export const AUTO_SYNC_KEY = 'auto_sync_enabled';
export const AUTO_RESPOND_IDS_KEY = 'auto_respond_user_ids';

export const CONFIG_MAX_LENGTHS: Record<string, number> = {
  greeting: 500,
  next_order_announcement: 500,
  mission: 500,
  rules: 2000,
  format: 2000,
  out_of_scope_reply: 500,
  shipping: 1000,
  pickup: 1000,
  payment: 500,
  refund_policy: 1000,
  membership: 2000,
  brand_story: 2000,
  contact: 500,
  ordering_process: 1000,
  reminders: 1000,
  price_reference: 2000,
};

export const DEFAULT_MAX_LENGTH = 2000;

const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /忽略(以上|上面|之前|先前)(的)?(指令|規則|提示|設定)/g,
];

export function hasSuspiciousContent(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((p) => {
    p.lastIndex = 0;
    return p.test(value);
  });
}

export const CONFIG_SECTIONS: Omit<ConfigItem, 'value'>[] = [
  {
    key: 'next_order_announcement',
    label: '下次開單時間公告',
    description: '顧客問「下次開單」時的回覆內容',
  },
  {
    key: 'greeting',
    label: '打招呼訊息',
    description: '顧客呼叫小螞蟻時的歡迎訊息（純文字）',
  },
  {
    key: 'mission',
    label: '任務目標',
    description: '客服助理的核心任務',
  },
  {
    key: 'rules',
    label: '回覆規則',
    description: '優先順序、禁止事項、未知問題處理',
  },
  {
    key: 'format',
    label: '回覆格式',
    description: '語氣、長度、emoji 使用、排版規則',
  },
  {
    key: 'out_of_scope_reply',
    label: '超出範圍回覆',
    description: '不相關問題的回覆模板',
  },
  {
    key: 'shipping',
    label: '運費與出貨',
    description: '運費金額、出貨時間、包裝說明',
  },
  {
    key: 'pickup',
    label: '取貨方式',
    description: '工作室自取的地點與規則',
  },
  {
    key: 'payment',
    label: '付款方式',
    description: '接受的付款方式',
  },
  {
    key: 'refund_policy',
    label: '退換貨政策',
    description: '退款條件與流程',
  },
  {
    key: 'membership',
    label: '會員制度',
    description: '會員等級、升級條件、優惠',
  },
  {
    key: 'brand_story',
    label: '品牌故事',
    description: '關於螞蟻窩甜點',
  },
  {
    key: 'contact',
    label: '聯絡資訊',
    description: '店名、地址、電話、社群連結',
  },
  {
    key: 'ordering_process',
    label: '訂購流程',
    description: '從瀏覽到下單的步驟',
  },
  {
    key: 'reminders',
    label: '注意事項',
    description: 'AI 回覆時的額外提醒',
  },
  {
    key: 'price_reference',
    label: '價格對照表',
    description: '所有商品價格由低到高排序',
  },
];

export const MODEL_FIELDS = [
  {
    key: 'classifier_model',
    label: '意圖分類器',
    desc: '分類用戶意圖，需要最快速度',
    defaultVal: 'gemini-2.5-flash-lite',
  },
  {
    key: 'ai_model',
    label: '標準回答',
    desc: '已知主題的回答',
    defaultVal: 'gemini-2.5-flash',
  },
  {
    key: 'strong_ai_model',
    label: '強模型',
    desc: '模糊/複雜問題，需要更強推理力',
    defaultVal: 'gemini-2.5-pro',
  },
  {
    key: 'failover_model',
    label: 'Failover',
    desc: '主模型失敗時的備援',
    defaultVal: 'gemini-2.5-flash',
  },
  {
    key: 'summary_model',
    label: '對話摘要',
    desc: 'Admin 後台的對話摘要生成',
    defaultVal: 'gemini-2.5-flash-lite',
  },
] as const;

export const MODEL_DEFAULTS: Record<string, string> = {
  classifier_model: 'gemini-2.5-flash-lite',
  ai_model: 'gemini-2.5-flash',
  strong_ai_model: 'gemini-2.5-pro',
  failover_model: 'gemini-2.5-flash-lite',
  summary_model: 'gemini-2.5-flash-lite',
};
