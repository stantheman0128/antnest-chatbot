import { GoogleGenerativeAI } from '@google/generative-ai';

import { getActiveProducts } from './data-service';
import { getSystemPrompt } from './knowledge-base';

export interface MessageHistory {
  role: string;
  content: string;
}

export interface ProductSpec {
  id: string;
  variantName?: string;
}

export interface AIResponse {
  text: string;
  productSpecs: ProductSpec[];
  escalate: boolean;
  escalateReason: string;
  skip: boolean;
  showPickupLink: boolean;
}

function getAIClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey || apiKey === 'your_google_ai_key_here') {
    throw new Error(
      'GOOGLE_AI_API_KEY not configured. Please:\n' +
        '1. Visit https://aistudio.google.com/apikey\n' +
        '2. Create a new API key\n' +
        '3. Add it to .env.local as: GOOGLE_AI_API_KEY=your_actual_key\n' +
        '4. Restart the development server',
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Build the product card instruction dynamically from active products.
 */
async function getProductCardInstruction(): Promise<{
  instruction: string;
  validIds: string[];
}> {
  const products = await getActiveProducts();
  const validIds = products.map((p) => p.id);
  const idList = validIds.join(', ');

  const instruction = `
<product_cards>
當你的回覆中提到具體商品時，請在回覆的最後一行加上：
SHOW_PRODUCTS: product-id-1, product-id-2

如果顧客問特定口味，可以指定口味名稱（會顯示該口味的專屬照片）：
SHOW_PRODUCTS: product-id/口味名稱

例如：SHOW_PRODUCTS: classic-tiramisu/威士忌咖啡酒香

可用的 product ID：
${idList}

規則：
• SHOW_PRODUCTS 裡只列出你在回覆文字中實際提到的商品，不要多列也不要少列
• 如果回覆提到全部品項（例如顧客問「有什麼甜點」），就全部列出
• 如果回覆只提到 1~2 個商品，就只列那幾個
• 回答保存方式、食用方式、運費、付款、訂購流程等問題時，不需要加 SHOW_PRODUCTS
• 一般閒聊、問候、道謝不需要加 SHOW_PRODUCTS
• 顧客問特定口味時用 product-id/口味名稱 格式
• SHOW_PRODUCTS 這行不會顯示給顧客看，系統會自動移除並轉換成商品卡片
</product_cards>

<response_control>
你是輔助角色，闆娘才是主要回覆者。不是每則訊息都需要你回覆。
收到訊息後，先判斷屬於以下哪種情況：

【回覆】你確定能幫上忙的問題：
• 商品介紹、價格、口味、規格
• 運費、付款方式、出貨時間
• 保存方式、賞味期限、食用方式
• 會員制度、優惠券
• 訂購流程、官網連結
• 品牌故事、聯絡資訊
• 打招呼、問好（「你好」「嗨」「請問」）→ 親切回應
• 道謝、結尾語（「謝謝」「感謝」「好的謝謝」）→ 簡短回應
→ 正常回覆，需要時加 SHOW_PRODUCTS

【預約取貨】顧客想預約自取、約取貨時間、約面交：
→ 回覆一句親切說明（例如「幫你送上預約連結，請選擇方便的時段！😊」）
→ 最後一行加 SHOW_PICKUP_LINK
→ SHOW_PICKUP_LINK 不會顯示給顧客，系統會自動送出預約按鈕

【轉接】需要闆娘親自處理的問題：
• 退換貨、退款
• 訂單問題（查單、改單、取消）
• 客訴、不滿、情緒激動
• 客製化需求（特殊口味、數量、包裝、企業訂購）
• 明確表示要找真人、闆娘、客服
• 任何你無法確定答案的問題
→ 給一句簡短安撫，最後一行加上 ESCALATE: 簡短原因
→ ESCALATE 不會顯示給顧客，系統會自動處理轉接

【靜默】不屬於以上兩類的訊息：
• 對話中的回應（「好的」「我知道了」「到了」「我快到了」）
• 圖片、貼圖的文字描述
• 看不出意圖的模糊訊息
• 明顯是在跟闆娘對話而非問問題
→ 只輸出 SKIP
→ 不要回覆任何文字，整則回覆就只有 SKIP 這個字

重要：寧可靜默也不要搶話。如果不確定該不該回覆，選擇 SKIP。
</response_control>
`;

  return { instruction, validIds };
}

/**
 * Strip markdown syntax from AI response text.
 * Gemini tends to output markdown regardless of instructions,
 * so we clean it up before sending to LINE (which doesn't render markdown).
 */
function stripMarkdown(text: string): string {
  return (
    text
      // Bold: **text** or __text__
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Italic: *text* or _text_ (but not emoji patterns like *_*)
      .replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, '$1')
      .replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, '$1')
      // Headers: # ## ### etc at line start
      .replace(/^#{1,6}\s+/gm, '')
      // Inline code: `text`
      .replace(/`([^`]+?)`/g, '$1')
      // Links: [text](url) → text
      .replace(/\[([^\]]+?)\]\([^)]+?\)/g, '$1')
      // Unordered list markers: - or * at line start → •
      .replace(/^[\s]*[-*]\s+/gm, '• ')
      // Blockquotes: > at line start
      .replace(/^>\s?/gm, '')
      // Horizontal rules: --- or *** or ___
      .replace(/^[-*_]{3,}\s*$/gm, '')
  );
}

function parseAIResponse(raw: string, validIds: string[]): AIResponse {
  const trimmedRaw = raw.trim();

  // SKIP signal — AI decided not to respond
  if (trimmedRaw === 'SKIP' || trimmedRaw.startsWith('SKIP:') || trimmedRaw.startsWith('SKIP\n')) {
    return {
      text: '',
      productSpecs: [],
      escalate: false,
      escalateReason: '',
      skip: true,
      showPickupLink: false,
    };
  }

  const lines = raw.split('\n');
  const productSpecs: ProductSpec[] = [];
  const textLines: string[] = [];
  let escalate = false;
  let escalateReason = '';
  let showPickupLink = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('SHOW_PRODUCTS:')) {
      const entries = trimmed
        .replace('SHOW_PRODUCTS:', '')
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean);
      for (const entry of entries) {
        // Support "product-id/variant-name" format
        const slashIdx = entry.indexOf('/');
        if (slashIdx > 0) {
          const id = entry.slice(0, slashIdx);
          const variantName = entry.slice(slashIdx + 1);
          if (validIds.includes(id)) {
            productSpecs.push({ id, variantName });
          }
        } else if (validIds.includes(entry)) {
          productSpecs.push({ id: entry });
        }
      }
    } else if (trimmed.startsWith('ESCALATE:')) {
      escalate = true;
      escalateReason = trimmed.replace('ESCALATE:', '').trim();
    } else if (trimmed === 'SHOW_PICKUP_LINK' || trimmed.startsWith('SHOW_PICKUP_LINK:')) {
      showPickupLink = true;
    } else {
      textLines.push(line);
    }
  }

  // Remove trailing empty lines
  while (textLines.length > 0 && textLines[textLines.length - 1].trim() === '') {
    textLines.pop();
  }

  return {
    text: stripMarkdown(textLines.join('\n')),
    productSpecs,
    escalate,
    escalateReason,
    skip: false,
    showPickupLink,
  };
}

/**
 * Split a long response into multiple shorter messages at paragraph breaks.
 * LINE chats are easier to read as multiple short bubbles than one wall of text.
 * Returns 1~3 segments max (LINE reply API limit is 5 messages total).
 */
export function splitResponse(text: string, maxSegments = 3): string[] {
  const trimmed = text.trim();

  // Short enough → don't split
  const lineCount = trimmed.split('\n').length;
  if (lineCount <= 8) return [trimmed];

  // Split at double-newline paragraph breaks
  const paragraphs = trimmed.split(/\n{2,}/);

  if (paragraphs.length <= 1) return [trimmed];

  // Merge paragraphs into segments, keeping each under ~8 lines
  const segments: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    const combined = current ? current + '\n\n' + para : para;
    const combinedLines = combined.split('\n').length;

    if (combinedLines > 8 && current) {
      segments.push(current.trim());
      current = para;
    } else {
      current = combined;
    }
  }
  if (current.trim()) segments.push(current.trim());

  // Cap at maxSegments — merge overflow into last segment
  while (segments.length > maxSegments) {
    const last = segments.pop()!;
    segments[segments.length - 1] += '\n\n' + last;
  }

  return segments.filter((s) => s.length > 0);
}

const MAX_USER_MESSAGE_LENGTH = 500;

function sanitizeUserInput(message: string): string {
  let sanitized = message.trim();

  // Truncate to max length
  if (sanitized.length > MAX_USER_MESSAGE_LENGTH) {
    sanitized = sanitized.slice(0, MAX_USER_MESSAGE_LENGTH);
  }

  // Strip XML-like tags that could interfere with system prompt structure
  sanitized = sanitized.replace(/<\/?[a-zA-Z_][a-zA-Z0-9_]*[^>]*>/g, '');

  // Neutralize common injection patterns (both English and Chinese)
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
    /忽略(以上|上面|之前|先前)(的)?(指令|規則|提示|設定)/g,
    /you\s+are\s+now\s+/gi,
    /你(現在|從現在起)是/g,
    /system\s*prompt/gi,
    /jailbreak/gi,
    /DAN\s+mode/gi,
    /pretend\s+(you\s+are|to\s+be)\s+/gi,
    /new\s+instructions?:/gi,
    /override\s+(all\s+)?rules/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, '[filtered]');
  }

  return sanitized;
}

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const FAILOVER_MODEL = 'gemini-2.5-flash';

async function callGemini(
  message: string,
  history: MessageHistory[],
  modelOverride?: string,
): Promise<{ text: string; validIds: string[]; model: string }> {
  const genAI = getAIClient();

  // Load system prompt, product card instruction, and admin-configured model in parallel
  const { getConfig } = await import('./data-service');
  const [systemPrompt, { instruction, validIds }, configModel] = await Promise.all([
    getSystemPrompt(),
    getProductCardInstruction(),
    getConfig('ai_model'),
  ]);

  const modelId = modelOverride || configModel || DEFAULT_MODEL;
  const fullPrompt = systemPrompt + '\n\n<!-- output instructions -->\n' + instruction;

  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: fullPrompt,
  });

  const contents = history
    .filter((msg) => msg.role && msg.content)
    .map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

  contents.push({
    role: 'user',
    parts: [{ text: sanitizeUserInput(message) }],
  });

  const response = await model.generateContent({
    contents,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.5,
    },
  });

  return { text: response.response.text() || '', validIds, model: modelId };
}

const FALLBACK: AIResponse = {
  text: '抱歉，系統暫時有點忙，請稍後再試，或直接聯繫我們的客服：\n📞 0906367231\n📧 evaboxbox@gmail.com',
  productSpecs: [],
  escalate: false,
  escalateReason: '',
  skip: false,
  showPickupLink: false,
};

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Generate AI response with auto-failover.
 * 1. Try admin-configured model (default: gemini-2.5-flash-lite) with 8s timeout
 * 2. If timeout/error → failover to gemini-2.5-flash with 15s timeout
 * 3. If still fails → return fallback message
 */
export async function generateAIResponse(
  message: string,
  history: MessageHistory[] = [],
): Promise<AIResponse> {
  // Attempt 1: primary model (fast, with 8s timeout)
  try {
    const startTime = Date.now();
    const {
      text: textContent,
      validIds,
      model,
    } = await withTimeout(callGemini(message, history), 8000, 'primary');
    const latencyMs = Date.now() - startTime;
    console.log(
      `[AI] model=${model} latency=${latencyMs}ms input_len=${message.length} output_len=${textContent.length}`,
    );

    if (textContent) {
      return parseAIResponse(textContent, validIds);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] Primary model failed: ${msg}`);
  }

  // Attempt 2: failover model (smarter, with 15s timeout)
  try {
    const startTime = Date.now();
    const {
      text: textContent,
      validIds,
      model,
    } = await withTimeout(callGemini(message, history, FAILOVER_MODEL), 15000, 'failover');
    const latencyMs = Date.now() - startTime;
    console.log(
      `[AI] failover model=${model} latency=${latencyMs}ms input_len=${message.length} output_len=${textContent.length}`,
    );

    if (textContent) {
      return parseAIResponse(textContent, validIds);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[AI] Failover model also failed: ${msg}`);
  }

  return FALLBACK;
}

/**
 * Generate a one-line summary of a customer's recent conversation.
 * Used in admin dashboard to quickly understand what a customer is asking about.
 */
export async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  if (messages.length === 0) return '尚無對話紀錄';

  try {
    const genAI = getAIClient();
    const model = genAI.getGenerativeModel({
      model: FAILOVER_MODEL,
      systemInstruction:
        '你是一個對話分析助手。用一句繁體中文簡短總結這位顧客最近主要在詢問什麼。不要超過 50 字。只輸出總結，不要加任何前綴或說明。',
    });

    const conversationText = messages
      .map((m) => (m.role === 'user' ? '顧客：' : '客服：') + m.content)
      .join('\n');

    const response = await withTimeout(
      model.generateContent({
        contents: [{ role: 'user', parts: [{ text: conversationText }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
      }),
      20000,
      'summary',
    );

    return response.response.text()?.trim() || '無法生成摘要';
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('generateConversationSummary error:', msg);
    return '摘要生成失敗';
  }
}
