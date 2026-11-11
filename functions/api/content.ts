import type { Env } from '../lib/env';

/** Latest published checklist rules. 204 = nothing published yet (the app uses its bundled rules). */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const row = await env.DB.prepare('SELECT content FROM content_versions ORDER BY version DESC LIMIT 1').first<{ content: string }>();
  if (!row) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return new Response(row.content, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
};
