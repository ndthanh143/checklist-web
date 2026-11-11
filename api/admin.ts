import { handleAdmin } from '../server/handlers.js';
import { json } from '../server/http.js';
import { vercelEnv } from '../server/vercelEnv.js';
import { vercelStore } from '../server/vercelStore.js';

// vercel.json rewrites /api/admin/<path> → /api/admin?path=<path>
function handler(request: Request): Promise<Response> | Response {
  const store = vercelStore();
  if (!store) return json({ error: 'No database connected. Add Neon Postgres to the Vercel project (Storage tab).' }, 503);
  const path = new URL(request.url).searchParams.get('path') ?? '';
  return handleAdmin(request, path.replace(/^\/+|\/+$/g, ''), vercelEnv(), store);
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
