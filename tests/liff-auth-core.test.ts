import { extractBearer, validateLineVerifyResponse } from '@/lib/liff-auth-core';

import { describe, expect, it } from 'vitest';

describe('extractBearer', () => {
  it('returns the token after "Bearer "', () => {
    expect(extractBearer('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('returns null when the prefix is missing or malformed', () => {
    expect(extractBearer('abc.def')).toBe(null);
    expect(extractBearer('bearer abc')).toBe(null); // case-sensitive
    expect(extractBearer('Bearer ')).toBe(null); // empty token
    expect(extractBearer(null)).toBe(null);
  });
});

describe('validateLineVerifyResponse', () => {
  const AUD = '1656789012';
  const good = { iss: 'https://access.line.me', sub: 'Uabc123', aud: AUD, exp: 9999999999, iat: 1 };

  it('accepts a valid response whose aud matches and returns the sub', () => {
    expect(validateLineVerifyResponse(good, AUD)).toEqual({ ok: true, userId: 'Uabc123' });
  });
  it('rejects a LINE error response', () => {
    expect(validateLineVerifyResponse({ error: 'invalid_request' }, AUD)).toEqual({ ok: false });
  });
  it('rejects an aud that does not match our channel', () => {
    expect(validateLineVerifyResponse({ ...good, aud: '9999' }, AUD)).toEqual({ ok: false });
  });
  it('rejects a response with no sub', () => {
    expect(validateLineVerifyResponse({ ...good, sub: '' }, AUD)).toEqual({ ok: false });
    expect(validateLineVerifyResponse({ iss: 'x', aud: AUD }, AUD)).toEqual({ ok: false });
  });
  it('rejects non-object input', () => {
    expect(validateLineVerifyResponse(null, AUD)).toEqual({ ok: false });
    expect(validateLineVerifyResponse('nope', AUD)).toEqual({ ok: false });
  });
});
