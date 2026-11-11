import { describe, expect, it } from 'vitest';
import { createSessionToken, readCookie, safeEqual, verifySessionToken } from './session';

describe('session cookie', () => {
  it('accepts its own token and rejects a different secret', async () => {
    const t = await createSessionToken('secret-a');
    expect(await verifySessionToken(t, 'secret-a')).toBe(true);
    expect(await verifySessionToken(t, 'secret-b')).toBe(false);
  });
  it('rejects tampered and expired tokens', async () => {
    const t = await createSessionToken('s', 0);
    expect(await verifySessionToken(t, 's', 1)).toBe(true);
    expect(await verifySessionToken(t, 's', 13 * 3600_000)).toBe(false);
    const [p, sig] = t.split('.');
    expect(await verifySessionToken(`${p}x.${sig}`, 's', 1)).toBe(false);
    expect(await verifySessionToken('garbage', 's')).toBe(false);
  });
  it('compares passwords exactly', async () => {
    expect(await safeEqual('MitekVietnam', 'MitekVietnam')).toBe(true);
    expect(await safeEqual('mitekvietnam', 'MitekVietnam')).toBe(false);
    expect(await safeEqual('', 'MitekVietnam')).toBe(false);
  });
  it('reads cookies', () => {
    const r = new Request('https://x', { headers: { cookie: 'a=1; lsc_session=abc.def; b=2' } });
    expect(readCookie(r, 'lsc_session')).toBe('abc.def');
    expect(readCookie(r, 'missing')).toBeNull();
  });
});
