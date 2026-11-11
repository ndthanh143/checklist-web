// Vercel Routing Middleware: the login gate for every page, asset and API route.
import { next } from '@vercel/functions/middleware';
import { gate } from './server/gate';
import { SECURITY_HEADERS } from './server/http';
import { vercelEnv } from './server/vercelEnv';

export const config = { matcher: '/:path*' };

export default async function middleware(request: Request): Promise<Response> {
  return (await gate(request, vercelEnv())) ?? next({ headers: SECURITY_HEADERS });
}
