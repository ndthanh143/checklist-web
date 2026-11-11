import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Env } from './env';
import { readCookie } from './session';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Who is using the Content editor. In production the /admin* and /api/admin* paths sit behind a
 * Cloudflare Access application (email one-time code). Access adds a signed JWT to every request,
 * which is verified here — a forged header is rejected.
 */
export async function adminEmail(request: Request, env: Env): Promise<string | null> {
  let email: string | null = null;
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? readCookie(request, 'CF_Authorization');
    if (!token) return null;
    const team = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
    let jwks = jwksCache.get(team);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
      jwksCache.set(team, jwks);
    }
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: env.ACCESS_AUD });
      email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    } catch {
      return null;
    }
  } else if (env.DEV_ADMIN_EMAIL) {
    // Local development only: never honoured on a real hostname.
    const host = new URL(request.url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') email = env.DEV_ADMIN_EMAIL.toLowerCase();
  }
  if (!email) return null;
  const allow = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(email)) return null;
  return email;
}
