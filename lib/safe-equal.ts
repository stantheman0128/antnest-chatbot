import { createHmac, timingSafeEqual } from 'node:crypto';

/** 定值時間字串比較（先各自 HMAC 成固定長度再比），用於密碼/token 秘密比對。 */
export function safeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const key = 'compare';
  const ha = createHmac('sha256', key).update(a).digest();
  const hb = createHmac('sha256', key).update(b).digest();
  return timingSafeEqual(ha, hb);
}
