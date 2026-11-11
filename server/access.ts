import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { ServerEnv } from './http';
import { ADMIN_COOKIE, readCookie, verifyToken } from './session';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Who is using the Content editor.
 * - Cloudflare: /admin* sits behind a Cloudflare Access application; its signed JWT is verified here.
 * - Vercel: the editor logs in with ADMIN_PASSWORD and their name (signed lsc_admin cookie).
 * - Local development: DEV_ADMIN_EMAIL, only on localhost.
 */
export async function adminIdentity(request: Request, env: ServerEnv): Promise<string | null> {
  let who: string | null = null;
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
      who = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    } catch {
      return null;
    }
  } else if (env.ADMIN_PASSWORD && env.SESSION_SECRET) {
    const token = readCookie(request, ADMIN_COOKIE);
    const payload = token ? await verifyToken(token, env.SESSION_SECRET) : null;
    who = payload?.kind === 'admin' && payload.name ? payload.name : null;
  } else if (env.DEV_ADMIN_EMAIL) {
    const host = new URL(request.url).hostname;
    if (host === 'localhost' || host === '127.0.0.1') who = env.DEV_ADMIN_EMAIL.toLowerCase();
  }
  if (!who) return null;
  const allow = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(who.toLowerCase())) return null;
  return who;
}

/** Which login the Content editor should show when there is no identity. */
export function adminLoginMode(env: ServerEnv): 'password' | 'access' | 'none' {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) return 'access';
  if (env.ADMIN_PASSWORD) return 'password';
  return 'none';
}
