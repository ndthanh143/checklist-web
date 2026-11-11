import { json, securityHeaders, type Env } from './lib/env';
import { readCookie, SESSION_COOKIE, verifySessionToken } from './lib/session';

// Everything except the login page needs a valid session cookie, including the app's
// JavaScript and the checklist rules, so nothing is readable before logging in.
const PUBLIC_PATHS = new Set(['/login', '/login.html', '/api/login', '/logos/lawmans.png', '/logos/mitek.png', '/logos/lawmans-icon.png']);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return securityHeaders(await ctx.next());

  if (!ctx.env.SESSION_SECRET || !ctx.env.SITE_PASSWORD) {
    return new Response('The site password is not configured. Set SITE_PASSWORD and SESSION_SECRET.', { status: 500 });
  }
  const token = readCookie(ctx.request, SESSION_COOKIE);
  if (token && (await verifySessionToken(token, ctx.env.SESSION_SECRET))) {
    return securityHeaders(await ctx.next());
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'Please log in again' }, 401);
  return Response.redirect(new URL('/login', url).toString(), 302);
};
