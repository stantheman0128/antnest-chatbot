import { POST } from '@/app/api/line/webhook/route';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks for external dependencies ──────────────────────────────
// The LINE SDK: validateSignature is called by POST; Client.replyMessage
// is the sink we inspect to see what the bot sent back.
const replyMessage = vi.fn(async () => ({}));
const validateSignature = vi.fn(() => true);

vi.mock('@line/bot-sdk', () => ({
  validateSignature: (...args: unknown[]) => validateSignature(...args),
  Client: class {
    replyMessage = replyMessage;
  },
}));

// AI client — control classification and generation outcomes per test.
const classifyIntent = vi.fn();
const generateAIResponse = vi.fn();
vi.mock('@/lib/ai-client', () => ({
  STRONG_MODEL_DEFAULT: 'strong-model',
  classifyIntent: (...a: unknown[]) => classifyIntent(...a),
  generateAIResponse: (...a: unknown[]) => generateAIResponse(...a),
  splitResponse: (text: string) => [text],
}));

// Data service — a controllable in-memory config + reservation surface.
const configStore = new Map<string, string>();
const getConfig = vi.fn(async (k: string) => configStore.get(k) ?? null);
const setConfig = vi.fn(async (k: string, v: string) => {
  configStore.set(k, v);
});
const deleteConfig = vi.fn(async (k: string) => {
  configStore.delete(k);
});
const getAvailableDates = vi.fn(async () => [] as unknown[]);
const getAvailabilityById = vi.fn(async () => null as unknown);
const getReservationById = vi.fn(async () => null as unknown);
const getLatestReservationByUser = vi.fn(async () => null as unknown);
const createReservation = vi.fn(async () => null as unknown);
const updateReservationStatus = vi.fn(async () => {});
const updateReservationNote = vi.fn(async () => {});
const getConversationHistory = vi.fn(async () => [] as unknown[]);
const logConversation = vi.fn(async () => {});
const upsertLineUser = vi.fn(async () => {});

vi.mock('@/lib/data-service', () => ({
  getConfig: (...a: unknown[]) => getConfig(...(a as [string])),
  setConfig: (...a: unknown[]) => setConfig(...(a as [string, string])),
  deleteConfig: (...a: unknown[]) => deleteConfig(...(a as [string])),
  getAvailableDates: (...a: unknown[]) => getAvailableDates(...a),
  getAvailabilityById: (...a: unknown[]) => getAvailabilityById(...a),
  getReservationById: (...a: unknown[]) => getReservationById(...a),
  getLatestReservationByUser: (...a: unknown[]) => getLatestReservationByUser(...a),
  createReservation: (...a: unknown[]) => createReservation(...a),
  updateReservationStatus: (...a: unknown[]) => updateReservationStatus(...a),
  updateReservationNote: (...a: unknown[]) => updateReservationNote(...a),
  getConversationHistory: (...a: unknown[]) => getConversationHistory(...a),
  logConversation: (...a: unknown[]) => logConversation(...a),
  upsertLineUser: (...a: unknown[]) => upsertLineUser(...a),
}));

// Flex builders — return recognizable sentinels so we can assert presence.
vi.mock('@/lib/flex-message', () => ({
  buildProductCarousel: vi.fn(async () => ({ type: 'flex', altText: 'products' })),
}));
vi.mock('@/lib/stock-checker', () => ({
  isStockQuery: vi.fn(() => false),
  refreshStockIfStale: vi.fn(async () => false),
}));

// ── Test helpers ─────────────────────────────────────────────────
let eventSeq = 0;

function makeRequest(body: unknown, signature: string | null = 'sig') {
  const raw = JSON.stringify(body);
  return {
    text: async () => raw,
    headers: {
      get: (name: string) => (name === 'x-line-signature' ? signature : null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

function textEvent(text: string, userId: string | undefined = 'U_test') {
  return {
    type: 'message',
    replyToken: 'reply-token',
    timestamp: Date.now(),
    message: { type: 'text', id: `msg-${eventSeq++}`, text },
    source: { userId },
  };
}

function postbackEvent(data: string, userId: string | undefined = 'U_test', time?: string) {
  return {
    type: 'postback',
    replyToken: 'reply-token',
    timestamp: Date.now(),
    webhookEventId: `pb-${eventSeq++}`,
    postback: { data, ...(time ? { params: { time } } : {}) },
    source: { userId },
  };
}

/** Flattened list of every message object passed to replyMessage across all calls. */
function sentMessages(): Array<Record<string, unknown>> {
  return replyMessage.mock.calls.flatMap((call) => call[1] as Record<string, unknown>[]);
}

beforeEach(() => {
  configStore.clear();
  vi.clearAllMocks();
  validateSignature.mockReturnValue(true);
  classifyIntent.mockResolvedValue({ topic: '其他', confidence: 'low', latencyMs: 1 });
  getAvailableDates.mockResolvedValue([]);
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test-token';
  process.env.LINE_CHANNEL_SECRET = 'test-secret';
  // fetch is used for profile + typing indicator; stub it away.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, json: async () => ({}) })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Signature / dispatch layer (what route.ts keeps after the split) ──
describe('POST signature verification', () => {
  it('rejects request with missing signature (401)', async () => {
    const res = await POST(makeRequest({ events: [] }, null));
    expect(res.status).toBe(401);
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('rejects request when validateSignature returns false (401)', async () => {
    validateSignature.mockReturnValue(false);
    const res = await POST(makeRequest({ events: [textEvent('hi')] }));
    expect(res.status).toBe(401);
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('returns 200 success for a valid empty batch', async () => {
    const res = await POST(makeRequest({ events: [] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it('returns 500 when the body is not valid JSON', async () => {
    const req = {
      text: async () => 'not-json',
      headers: { get: () => 'sig' },
    } as unknown as Parameters<typeof POST>[0];
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});

describe('POST event dispatch', () => {
  it('deduplicates events sharing the same message id', async () => {
    configStore.set('active_until:U_dup', (Date.now() + 60_000).toString());
    const evt = textEvent('呼叫闆娘', 'U_dup');
    await POST(makeRequest({ events: [evt, { ...evt }] }));
    // Same message.id → second is skipped → handler runs once.
    expect(replyMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores event types that are neither text message nor postback', async () => {
    const res = await POST(makeRequest({ events: [{ type: 'follow', replyToken: 'r' }] }));
    expect(res.status).toBe(200);
    expect(replyMessage).not.toHaveBeenCalled();
  });
});

// ── Representative text-handler behaviors ────────────────────────
describe('handleTextMessage keyword routing', () => {
  it('"呼叫闆娘" hands off to human and pauses the bot', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    await POST(makeRequest({ events: [textEvent('呼叫闆娘')] }));
    const msgs = sentMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toContain('已為你轉接闆娘');
    // bot deactivated
    expect(configStore.has('active_until:U_test')).toBe(false);
  });

  it('"呼叫小螞蟻" activates the bot and greets', async () => {
    await POST(makeRequest({ events: [textEvent('呼叫小螞蟻')] }));
    const msgs = sentMessages();
    expect(msgs[0].text).toContain('小螞蟻回來啦');
    expect(configStore.has('active_until:U_test')).toBe(true);
  });

  it('"呼叫小螞蟻" uses the configured greeting when present', async () => {
    configStore.set('greeting', 'CUSTOM GREETING');
    await POST(makeRequest({ events: [textEvent('呼叫客服')] }));
    expect(sentMessages()[0].text).toBe('CUSTOM GREETING');
  });

  it('"我的ID" replies with the LINE user id', async () => {
    await POST(makeRequest({ events: [textEvent('我的ID')] }));
    expect(sentMessages()[0].text).toContain('U_test');
  });

  it('ignores messages longer than 2000 chars without replying', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    await POST(makeRequest({ events: [textEvent('x'.repeat(2001))] }));
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('does not respond when the bot is inactive for the user', async () => {
    await POST(makeRequest({ events: [textEvent('隨便問一句')] }));
    expect(replyMessage).not.toHaveBeenCalled();
  });

  it('booking keyword shows an empty-slots notice when no dates are available', async () => {
    getAvailableDates.mockResolvedValue([]);
    await POST(makeRequest({ events: [textEvent('我要預約取貨')] }));
    const msgs = sentMessages();
    expect(msgs[0].text).toContain('目前沒有可預約的取貨時段');
  });

  it('query-reservation keyword reports no record when user has none', async () => {
    getLatestReservationByUser.mockResolvedValue(null);
    await POST(makeRequest({ events: [textEvent('我的預約')] }));
    expect(sentMessages()[0].text).toContain('查無預約紀錄');
  });

  it('pending note is saved when active user sends free text after booking', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    configStore.set('pending_note:U_test', 'res-123');
    await POST(makeRequest({ events: [textEvent('訂單編號 A100')] }));
    expect(updateReservationNote).toHaveBeenCalledWith('res-123', '訂單編號 A100');
    expect(sentMessages()[0].text).toContain('已加入備註');
    expect(configStore.has('pending_note:U_test')).toBe(false);
  });
});

describe('handleTextMessage AI path', () => {
  it('sends AI text and a product carousel when products are returned', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    classifyIntent.mockResolvedValue({ topic: '商品介紹', confidence: 'high', latencyMs: 5 });
    generateAIResponse.mockResolvedValue({
      text: '這是我們的蛋糕',
      productSpecs: [{ id: 'p1' }],
      skip: false,
      escalate: false,
      showPickupLink: false,
    });
    await POST(makeRequest({ events: [textEvent('有什麼蛋糕')] }));
    const msgs = sentMessages();
    expect(msgs.some((m) => m.text === '這是我們的蛋糕')).toBe(true);
    expect(msgs.some((m) => m.type === 'flex')).toBe(true);
  });

  it('escalates to human and deactivates when AI sets escalate', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    classifyIntent.mockResolvedValue({ topic: '其他', confidence: 'low', latencyMs: 5 });
    generateAIResponse.mockResolvedValue({
      text: '需要真人協助',
      productSpecs: [],
      skip: false,
      escalate: true,
      escalateReason: 'complex',
      showPickupLink: false,
    });
    await POST(makeRequest({ events: [textEvent('很複雜的問題')] }));
    expect(sentMessages()[0].text).toBe('需要真人協助');
    expect(configStore.has('active_until:U_test')).toBe(false);
  });

  it('sends a fallback message when AI generation throws', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    generateAIResponse.mockRejectedValue(new Error('boom'));
    await POST(makeRequest({ events: [textEvent('問題')] }));
    expect(sentMessages()[0].text).toContain('腦袋轉不過來');
  });

  it('high-confidence 開單補貨 classification returns the announcement without calling AI', async () => {
    configStore.set('active_until:U_test', (Date.now() + 60_000).toString());
    configStore.set('next_order_announcement', '下週一開單');
    classifyIntent.mockResolvedValue({ topic: '開單補貨', confidence: 'high', latencyMs: 5 });
    await POST(makeRequest({ events: [textEvent('什麼時候開單')] }));
    expect(sentMessages()[0].text).toBe('下週一開單');
    expect(generateAIResponse).not.toHaveBeenCalled();
  });
});

// ── Representative postback-handler behaviors ────────────────────
describe('handlePostback routing', () => {
  it('FEEDBACK:BAD acknowledges the feedback', async () => {
    await POST(makeRequest({ events: [postbackEvent('FEEDBACK:BAD')] }));
    expect(sentMessages()[0].text).toContain('感謝你的回饋');
  });

  it('SKIP_NOTE clears pending note and confirms', async () => {
    configStore.set('pending_note:U_test', 'res-9');
    await POST(makeRequest({ events: [postbackEvent('SKIP_NOTE')] }));
    expect(configStore.has('pending_note:U_test')).toBe(false);
    expect(sentMessages()[0].text).toBe('好的！');
  });

  it('CANCEL_MY_RES rejects when the reservation is not owned by the user', async () => {
    getReservationById.mockResolvedValue({ id: 'r1', lineUserId: 'OTHER', status: 'confirmed' });
    await POST(makeRequest({ events: [postbackEvent('CANCEL_MY_RES:r1')] }));
    expect(sentMessages()[0].text).toContain('無法取消此預約');
    expect(updateReservationStatus).not.toHaveBeenCalled();
  });

  it('CANCEL_MY_RES cancels an owned, active reservation', async () => {
    getReservationById.mockResolvedValue({ id: 'r1', lineUserId: 'U_test', status: 'confirmed' });
    await POST(makeRequest({ events: [postbackEvent('CANCEL_MY_RES:r1')] }));
    expect(updateReservationStatus).toHaveBeenCalledWith('r1', 'cancelled');
    expect(sentMessages()[0].text).toContain('已取消你的預約');
  });

  it('legacy CONFIRM_RES postback returns the deprecation notice', async () => {
    await POST(makeRequest({ events: [postbackEvent('CONFIRM_RES:x')] }));
    expect(sentMessages()[0].text).toContain('此功能已更新');
  });

  it('unknown postback data sends no reply', async () => {
    await POST(makeRequest({ events: [postbackEvent('TOTALLY_UNKNOWN')] }));
    expect(replyMessage).not.toHaveBeenCalled();
  });
});
