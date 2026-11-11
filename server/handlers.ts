import { contentSchema } from '../src/content/schema';
import { adminIdentity, adminLoginMode } from './access';
import { json, type ServerEnv } from './http';
import type { RulesStore, VersionRow } from './store';

// Rules API handlers shared by Cloudflare Pages Functions (functions/) and Vercel (api/).

/** GET /api/content — latest published rules; 204 when nothing is published yet. */
export async function handleContent(store: RulesStore): Promise<Response> {
  const content = await store.latestContent();
  if (!content) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return new Response(content, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

const toInfo = (r: VersionRow) => ({ version: r.version, publishedAt: r.published_at, publishedBy: r.published_by, note: r.note });

async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function publish(store: RulesStore, content: unknown, note: string, by: string): Promise<Response> {
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return json({ error: `Rules are not valid: ${issue?.path.join(' › ')} ${issue?.message}` }, 400);
  }
  const version = (await store.maxVersion()) + 1;
  const now = new Date().toISOString();
  const stored = { ...parsed.data, version, updatedAt: now };
  try {
    await store.publish(version, JSON.stringify(stored), now, by, note.slice(0, 500));
  } catch {
    return json({ error: 'Someone else published at the same time. Reload and try again.' }, 409);
  }
  return json({ version, publishedAt: now, publishedBy: by, note });
}

/**
 * Content editor API. `path` is the part after /api/admin/.
 *   GET me · GET/PUT/DELETE draft · POST publish · GET history · GET versions/:v · POST rollback
 */
export async function handleAdmin(request: Request, path: string, env: ServerEnv, store: RulesStore): Promise<Response> {
  const who = await adminIdentity(request, env);
  if (!who) {
    const mode = adminLoginMode(env);
    if (mode === 'password') return json({ error: 'Log in to the Content editor', login: 'password' }, 401);
    return json({ error: 'You do not have access to the Content editor' }, 403);
  }
  const method = request.method;

  if (path === 'me' && method === 'GET') return json({ email: who });

  if (path === 'draft') {
    if (method === 'GET') {
      const row = await store.getDraft();
      if (!row) return json({ draft: null });
      return json({ content: JSON.parse(row.content), updatedAt: row.updated_at, updatedBy: row.updated_by });
    }
    if (method === 'PUT') {
      const body = await readBody<{ content: unknown }>(request);
      if (!body?.content || typeof body.content !== 'object') return json({ error: 'Missing content' }, 400);
      const text = JSON.stringify(body.content);
      if (text.length > 2_000_000) return json({ error: 'Rules are too large' }, 413);
      const now = new Date().toISOString();
      await store.saveDraft(text, now, who);
      return json({ updatedAt: now });
    }
    if (method === 'DELETE') {
      await store.deleteDraft();
      return json({ ok: true });
    }
  }

  if (path === 'publish' && method === 'POST') {
    const body = await readBody<{ content: unknown; note?: string }>(request);
    if (!body?.content) return json({ error: 'Missing content' }, 400);
    if (!body.note?.trim()) return json({ error: 'Write a note about what changed' }, 400);
    return publish(store, body.content, body.note.trim(), who);
  }

  if (path === 'history' && method === 'GET') return json({ versions: (await store.history(200)).map(toInfo) });

  const versionMatch = /^versions\/(\d+)$/.exec(path);
  if (versionMatch && method === 'GET') {
    const row = await store.getVersion(Number(versionMatch[1]));
    if (!row) return json({ error: 'Version not found' }, 404);
    return json({ ...toInfo(row), content: JSON.parse(row.content) });
  }

  if (path === 'rollback' && method === 'POST') {
    const body = await readBody<{ version: number; note?: string }>(request);
    if (!body || typeof body.version !== 'number') return json({ error: 'Missing version' }, 400);
    const row = await store.getVersion(body.version);
    if (!row) return json({ error: 'Version not found' }, 404);
    return publish(store, JSON.parse(row.content), body.note?.trim() || `Restored version ${body.version}`, who);
  }

  return json({ error: 'Not found' }, 404);
}
