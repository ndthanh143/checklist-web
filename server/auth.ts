import { json, type ServerEnv } from './http.js';
import { ADMIN_COOKIE, clearSessionCookie, cookie, createSessionToken, safeEqual, sessionCookie, SESSION_HOURS, signToken } from './session.js';

// Login / logout handlers (small: no database, no schema), shared by Cloudflare and Vercel.

const slowDown = () => new Promise((r) => setTimeout(r, 600));

/** POST /api/login (form field "password"). */
export async function handleLogin(request: Request, env: ServerEnv): Promise<Response> {
  const url = new URL(request.url);
  if (!env.SITE_PASSWORD || !env.SESSION_SECRET) return new Response('Not configured', { status: 500 });
  let password = '';
  try {
    password = String((await request.formData()).get('password') ?? '');
  } catch {
    /* empty */
  }
  if (!(await safeEqual(password, env.SITE_PASSWORD))) {
    await slowDown();
    return new Response(null, { status: 303, headers: { Location: new URL('/login?error=1', url).toString() } });
  }
  const token = await createSessionToken(env.SESSION_SECRET);
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': sessionCookie(token) } });
}

/** GET /api/logout */
export function handleLogout(): Response {
  const headers = new Headers({ Location: '/login' });
  headers.append('Set-Cookie', clearSessionCookie());
  headers.append('Set-Cookie', cookie(ADMIN_COOKIE, '', 0));
  return new Response(null, { status: 303, headers });
}

/** POST /api/admin-login {name, password} — Content editor login when ADMIN_PASSWORD is used (Vercel). */
export async function handleAdminLogin(request: Request, env: ServerEnv): Promise<Response> {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return json({ error: 'The Content editor password is not configured (ADMIN_PASSWORD).' }, 500);
  let body: { name?: string; password?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    /* empty */
  }
  const name = (body.name ?? '').trim().slice(0, 60);
  if (!name) return json({ error: 'Enter your name' }, 400);
  if (!(await safeEqual(body.password ?? '', env.ADMIN_PASSWORD))) {
    await slowDown();
    return json({ error: 'That password is not right' }, 401);
  }
  const token = await signToken({ exp: Date.now() + SESSION_HOURS * 3600_000, kind: 'admin', name }, env.SESSION_SECRET);
  return json({ name }, 200, { 'Set-Cookie': cookie(ADMIN_COOKIE, token, SESSION_HOURS * 3600) });
}

