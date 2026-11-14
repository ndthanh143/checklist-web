import { json, type ServerEnv } from './http.js';
import { readCookie, SESSION_COOKIE, verifySessionToken } from './session.js';

// Everything except the login page needs a valid session cookie, including the app's
// JavaScript and the checklist rules, so nothing is readable before logging in.
export const PUBLIC_PATHS = new Set([
  '/login',
  '/login.html',
  '/api/login',
  '/logos/lawmans.png',
  '/logos/mitek.png',
  '/logos/smart-check-wall.png',
  '/logos/smart-check-wall-icon.png',
  '/logos/apple-touch-icon.png',
  '/illustrations/wall-frame.svg',
  '/favicon.ico',
]);

/** Returns a response that blocks the request, or null when the request may continue. */
export async function gate(request: Request, env: ServerEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return null;
  if (!env.SESSION_SECRET || !env.SITE_PASSWORD) {
    return new Response('The site password is not configured. Set SITE_PASSWORD and SESSION_SECRET.', { status: 500 });
  }
  const token = readCookie(request, SESSION_COOKIE);
  if (token && (await verifySessionToken(token, env.SESSION_SECRET))) return null;
  if (url.pathname.startsWith('/api/')) return json({ error: 'Please log in again' }, 401);
  return Response.redirect(new URL('/login', url).toString(), 302);
}
