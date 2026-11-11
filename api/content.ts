import { handleContent } from '../server/handlers.js';
import { vercelStore } from '../server/vercelStore.js';

export function GET(): Promise<Response> | Response {
  const store = vercelStore();
  // No database connected yet: the app uses its bundled rules.
  if (!store) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return handleContent(store);
}
