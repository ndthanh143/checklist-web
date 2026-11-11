import { handleContent } from '../server/handlers';
import { vercelStore } from '../server/vercelStore';

export const config = { runtime: 'edge' };

export default function handler(): Promise<Response> | Response {
  const store = vercelStore();
  // No database connected yet: the app uses its bundled rules.
  if (!store) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return handleContent(store);
}
