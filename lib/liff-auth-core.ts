export type VerifyResult = { ok: true; userId: string } | { ok: false };

/** 從 Authorization header 取出 Bearer token（大小寫敏感），沒有就回 null。 */
export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return null;
  const token = header.slice(prefix.length).trim();
  return token || null;
}

/**
 * 驗證 LINE `/oauth2/v2.1/verify` 的回應：必須沒有 error、有 sub、aud 等於我們的
 * channel id，才回傳可信的 userId(sub)。任何一項不符都回 { ok: false }。
 */
export function validateLineVerifyResponse(data: unknown, expectedAud: string): VerifyResult {
  if (!data || typeof data !== 'object') return { ok: false };
  const d = data as Record<string, unknown>;
  if (d.error) return { ok: false };
  if (typeof d.sub !== 'string' || d.sub.length === 0) return { ok: false };
  if (String(d.aud) !== expectedAud) return { ok: false };
  return { ok: true, userId: d.sub };
}
