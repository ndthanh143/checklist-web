import { handleAdmin } from '../server/handlers';
import { json } from '../server/http';
import { vercelEnv } from '../server/vercelEnv';
import { vercelStore } from '../server/vercelStore';

export const config = { runtime: 'edge' };

// vercel.json rewrites /api/admin/<path> → /api/admin?path=<path>
export default function handler(request: Request): Promise<Response> | Response {
  const store = vercelStore();
  if (!store) return json({ error: 'No database connected. Add Neon Postgres to the Vercel project (Storage tab).' }, 503);
  const path = new URL(request.url).searchParams.get('path') ?? '';
  return handleAdmin(request, path.replace(/^\/+|\/+$/g, ''), vercelEnv(), store);
}
