// Vercel Routing Middleware: the login gate for every page, asset and API route.
import { next } from '@vercel/functions/middleware';
import { gate } from './server/gate.js';
import { SECURITY_HEADERS } from './server/http.js';
import { vercelEnv } from './server/vercelEnv.js';

// No matcher: runs for every path (pages, assets, API).
export const config = { runtime: 'nodejs' };

export default async function middleware(request: Request): Promise<Response> {
  return (await gate(request, vercelEnv())) ?? next({ headers: SECURITY_HEADERS });
}
