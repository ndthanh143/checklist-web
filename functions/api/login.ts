import type { Env } from '../lib/env';
import { createSessionToken, safeEqual, sessionCookie } from '../lib/session';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  if (!env.SITE_PASSWORD || !env.SESSION_SECRET) return new Response('Not configured', { status: 500 });
  let password = '';
  try {
    const form = await request.formData();
    password = String(form.get('password') ?? '');
  } catch {
    /* empty */
  }
  if (!(await safeEqual(password, env.SITE_PASSWORD))) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.redirect(new URL('/login?error=1', url).toString(), 303);
  }
  const token = await createSessionToken(env.SESSION_SECRET);
  return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': sessionCookie(token) } });
};
