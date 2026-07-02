type Entry = { count: number; resetAt: number };

/**
 * 以 key（通常是 IP）計數的滑動窗限流器。now 由呼叫端傳入（Date.now()）方便測試。
 * hit() 回傳 true=允許並計入一次，false=已達上限。
 * 注意：狀態存記憶體，serverless 多實例下各自計數，屬「拖慢濫用」等級的防護。
 */
export function createRateLimiter(opts: { max: number; windowMs: number }) {
  const hits = new Map<string, Entry>();
  return {
    hit(key: string, now: number): boolean {
      const e = hits.get(key);
      if (!e || now > e.resetAt) {
        hits.set(key, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (e.count >= opts.max) return false;
      e.count += 1;
      return true;
    },
  };
}
