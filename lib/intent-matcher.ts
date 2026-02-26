import fs from "fs";
import path from "path";

interface FAQPair {
  intent: string;
  keywords: string[];
  response: string;
}

interface MatchResult {
  matched: boolean;
  response?: string;
  intent?: string;
}

let faqPairs: FAQPair[] | null = null;

function loadFAQPairs(): FAQPair[] {
  if (faqPairs) return faqPairs;

  try {
    const faqPath = path.join(process.cwd(), "data", "faq-pairs.json");
    const content = fs.readFileSync(faqPath, "utf-8");
    faqPairs = JSON.parse(content);
    return faqPairs!;
  } catch (error) {
    console.error("Failed to load FAQ pairs:", error);
    return [];
  }
}

function containsKeywords(message: string, keywords: string[]): number {
  let count = 0;
  const lowerMessage = message.toLowerCase();

  for (const keyword of keywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      count++;
    }
  }

  return count;
}

// 檢查訊息是否包含「需要 AI 推理」的信號詞
// 推薦、比較、選擇、組合等問題都應該讓 AI 處理
function needsAIReasoning(message: string): boolean {
  const reasoningSignals = [
    "推薦", "建議", "適合", "比較", "哪個好",
    "怎麼選", "怎麼挑", "選擇", "組合", "搭配",
    "預算", "送禮", "送人", "cp值", "值得",
    "差別", "差異", "不同", "哪一款", "哪款",
    "過敏", "客製", "訂做", "生日", "幾個人吃",
  ];

  const lowerMessage = message.toLowerCase();
  return reasoningSignals.some((signal) => lowerMessage.includes(signal));
}

/**
 * 保守的意圖比對
 *
 * 設計原則：
 * - 只處理明確、簡單的 FAQ 查詢
 * - 需要推理、推薦、比較的問題一律交給 AI
 * - 訊息越長，越可能需要 AI 理解上下文
 * - greeting 只在訊息很短時觸發
 */
export function matchIntent(message: string): MatchResult {
  if (!message || typeof message !== "string") {
    return { matched: false };
  }

  const trimmed = message.trim();
  const faqs = loadFAQPairs();

  // 如果訊息包含推理信號詞，直接交給 AI
  if (needsAIReasoning(trimmed)) {
    return { matched: false };
  }

  // 找出所有匹配的 FAQ
  const matches: Array<{ faq: FAQPair; count: number }> = [];

  for (const faq of faqs) {
    const count = containsKeywords(trimmed, faq.keywords);
    if (count > 0) {
      matches.push({ faq, count });
    }
  }

  if (matches.length === 0) {
    return { matched: false };
  }

  // 按匹配數量排序
  matches.sort((a, b) => b.count - a.count);
  const best = matches[0];

  // greeting 特殊處理：只在短訊息且沒有其他更好的匹配時觸發
  if (best.faq.intent === "greeting") {
    // 如果訊息很短（純打招呼），直接回應
    if (trimmed.length <= 10) {
      return { matched: true, response: best.faq.response, intent: "greeting" };
    }
    // 訊息長但也命中了 greeting → 看有沒有其他更好的匹配
    if (matches.length > 1) {
      const secondBest = matches[1];
      return {
        matched: true,
        response: secondBest.faq.response,
        intent: secondBest.faq.intent,
      };
    }
    // 訊息長且只有 greeting 命中 → 交給 AI
    return { matched: false };
  }

  // 訊息超過 12 字且只命中 1 個關鍵字 → 信心不足，交給 AI
  // 短而直接的問句（如「運費多少」「怎麼下單」）才用模板
  if (trimmed.length > 12 && best.count === 1) {
    return { matched: false };
  }

  // 多個意圖同分 → 意圖不明確，交給 AI
  if (matches.length > 1 && matches[0].count === matches[1].count) {
    return { matched: false };
  }

  return {
    matched: true,
    response: best.faq.response,
    intent: best.faq.intent,
  };
}
