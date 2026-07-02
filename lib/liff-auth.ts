import { NextRequest } from 'next/server';

import { extractBearer, validateLineVerifyResponse } from './liff-auth-core';

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

/** LINE Login channel id：驗證 LIFF ID token 的 aud。優先用顯式 env，退而取 LIFF ID 前綴。 */
function getChannelId(): string | null {
  const explicit = process.env.LINE_LOGIN_CHANNEL_ID;
  if (explicit) return explicit;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (liffId && liffId.includes('-')) return liffId.split('-')[0];
  return null;
}

/**
 * 從請求的 Authorization: Bearer <LIFF ID token> 驗出可信的 LINE userId。
 * 交給 LINE 官方 verify endpoint 驗簽章與效期，再核對 aud=我們的 channel。
 * 失敗（沒 token、驗不過、未設定 channel id）一律回 null，呼叫端據此擋掉。
 */
export async function verifyLiffUser(req: NextRequest): Promise<string | null> {
  const token = extractBearer(req.headers.get('authorization'));
  if (!token) return null;

  const channelId = getChannelId();
  if (!channelId) {
    console.warn('[liff-auth] LINE_LOGIN_CHANNEL_ID not configured — rejecting LIFF request.');
    return null;
  }

  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: token, client_id: channelId }),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const result = validateLineVerifyResponse(data, channelId);
    return result.ok ? result.userId : null;
  } catch {
    return null;
  }
}
