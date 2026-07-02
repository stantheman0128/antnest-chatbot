import { createRateLimiter } from '@/lib/rate-limiter';

import { describe, expect, it } from 'vitest';

describe('createRateLimiter', () => {
  it('allows up to max hits within the window, then limits', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    expect(rl.hit('ip', 0)).toBe(true);
    expect(rl.hit('ip', 0)).toBe(true);
    expect(rl.hit('ip', 0)).toBe(true);
    expect(rl.hit('ip', 0)).toBe(false); // 4th within window
  });

  it('resets after the window elapses', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.hit('ip', 0)).toBe(true);
    expect(rl.hit('ip', 500)).toBe(false);
    expect(rl.hit('ip', 1001)).toBe(true); // window passed
  });

  it('tracks keys independently', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    expect(rl.hit('a', 0)).toBe(true);
    expect(rl.hit('a', 0)).toBe(false);
    expect(rl.hit('b', 0)).toBe(true);
  });
});
