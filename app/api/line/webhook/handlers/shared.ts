import { deleteConfig, getAvailableDates, getConfig, setConfig } from '@/lib/data-service';
import { buildPickupDateCarousel } from '@/lib/pickup-flex';
import { getQuickReply } from '@/lib/quick-replies';
import { Client, Message, TextMessage } from '@line/bot-sdk';

// Dedup: prevent processing the same event multiple times
const recentEvents = new Map<string, number>();
const DEDUP_TTL = 30_000; // 30 seconds

// Opt-in: bot is silent by default, activated by "呼叫小螞蟻"
// State persisted in Supabase system_config as `active_until:{userId}` = expiry timestamp
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 min without bot response → auto-deactivate

export async function isUserActive(userId: string): Promise<boolean> {
  const expiresAt = await getConfig(`active_until:${userId}`);
  if (!expiresAt) return false;
  if (Date.now() > parseInt(expiresAt)) {
    // Expired — clean up async (fire-and-forget)
    void deleteConfig(`active_until:${userId}`);
    return false;
  }
  return true;
}

export async function activateUser(userId: string) {
  const expiresAt = (Date.now() + IDLE_TIMEOUT).toString();
  await setConfig(`active_until:${userId}`, expiresAt);
}

export async function deactivateUser(userId: string) {
  await deleteConfig(`active_until:${userId}`);
}

/** Extend idle timeout — called after bot sends a message */
export async function touchBotActivity(userId: string) {
  const expiresAt = (Date.now() + IDLE_TIMEOUT).toString();
  await setConfig(`active_until:${userId}`, expiresAt);
}

export function isDuplicate(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of recentEvents) {
    if (now - ts > DEDUP_TTL) recentEvents.delete(id);
  }
  if (recentEvents.has(eventId)) return true;
  recentEvents.set(eventId, now);
  return false;
}

function getLineClient() {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  return new Client({
    channelAccessToken: token,
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
  });
}

export async function sendMessages(
  replyToken: string,
  _userId: string | undefined,
  messages: Message[],
) {
  await getLineClient().replyMessage(replyToken, messages);
}

interface LineProfile {
  displayName: string;
  pictureUrl?: string;
}

export async function getLineProfile(userId: string): Promise<LineProfile | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as LineProfile;
  } catch {
    return null;
  }
}

/** Build pickup date carousel messages (does not send — caller decides) */
export async function buildPickupMessages(introText?: string): Promise<Message[]> {
  const availabilities = await getAvailableDates();

  if (availabilities.length === 0) {
    const msg: TextMessage = {
      type: 'text',
      text: '目前沒有可預約的取貨時段，請稍後再試或直接聯繫闆娘 😊',
      quickReply: getQuickReply(false),
    };
    return [msg];
  }

  const carousel = buildPickupDateCarousel(availabilities);
  if (!carousel) return [];

  const intro: TextMessage = {
    type: 'text',
    text: introText || '以下是可取貨的日期，請選擇 📅',
  };

  return [intro, carousel as Message];
}

/** Send pickup date carousel */
export async function sendPickupDateCarousel(replyToken: string, userId: string | undefined) {
  const messages = await buildPickupMessages();
  if (messages.length > 0) {
    await sendMessages(replyToken, userId, messages);
  }
}
