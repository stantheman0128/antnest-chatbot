import { safeEqualStr } from '@/lib/safe-equal';

import { describe, expect, it } from 'vitest';

describe('safeEqualStr', () => {
  it('is true for identical strings', () => {
    expect(safeEqualStr('secret', 'secret')).toBe(true);
  });
  it('is false for different strings of equal length', () => {
    expect(safeEqualStr('secret', 'secrat')).toBe(false);
  });
  it('is false for different lengths without throwing', () => {
    expect(safeEqualStr('a', 'a-longer-value')).toBe(false);
  });
  it('is false when either side is empty', () => {
    expect(safeEqualStr('', 'x')).toBe(false);
    expect(safeEqualStr('x', '')).toBe(false);
  });
});
