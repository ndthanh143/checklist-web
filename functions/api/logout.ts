import type { Env } from '../lib/env';
import { clearSessionCookie } from '../lib/session';

export const onRequestGet: PagesFunction<Env> = async () =>
  new Response(null, { status: 303, headers: { Location: '/login', 'Set-Cookie': clearSessionCookie() } });
