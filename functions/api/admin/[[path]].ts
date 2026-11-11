import { contentSchema } from '../../../src/content/schema';
import { adminEmail } from '../../lib/access';
import { json, type Env } from '../../lib/env';

// Content editor API. Every route needs an editor identity (Cloudflare Access).
//   GET    /api/admin/me
//   GET    /api/admin/draft          PUT /api/admin/draft {content}     DELETE /api/admin/draft
//   POST   /api/admin/publish {content, note}
//   GET    /api/admin/history
//   GET    /api/admin/versions/:v
//   POST   /api/admin/rollback {version, note}

interface VersionRow {
  version: number;
  published_at: string;
  published_by: string;
  note: string;
}

const toInfo = (r: VersionRow) => ({ version: r.version, publishedAt: r.published_at, publishedBy: r.published_by, note: r.note });

async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function publish(env: Env, content: unknown, note: string, by: string): Promise<Response> {
  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return json({ error: `Rules are not valid: ${parsed.error.issues[0]?.path.join(' › ')} ${parsed.error.issues[0]?.message}` }, 400);
  const last = await env.DB.prepare('SELECT MAX(version) AS v FROM content_versions').first<{ v: number | null }>();
  const version = (last?.v ?? 0) + 1;
  const now = new Date().toISOString();
  const stored = { ...parsed.data, version, updatedAt: now };
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO content_versions (version, content, published_at, published_by, note) VALUES (?, ?, ?, ?, ?)').bind(version, JSON.stringify(stored), now, by, note.slice(0, 500)),
      env.DB.prepare('DELETE FROM content_draft'),
    ]);
  } catch {
    return json({ error: 'Someone else published at the same time. Reload and try again.' }, 409);
  }
  return json({ version, publishedAt: now, publishedBy: by, note });
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  const email = await adminEmail(request, env);
  if (!email) return json({ error: 'You do not have access to the Content editor' }, 403);

  const path = (Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)).join('/');
  const method = request.method;

  if (path === 'me' && method === 'GET') return json({ email });

  if (path === 'draft') {
    if (method === 'GET') {
      const row = await env.DB.prepare('SELECT content, updated_at, updated_by FROM content_draft WHERE id = 1').first<{ content: string; updated_at: string; updated_by: string }>();
      if (!row) return json({ draft: null });
      return json({ content: JSON.parse(row.content), updatedAt: row.updated_at, updatedBy: row.updated_by });
    }
    if (method === 'PUT') {
      const body = await readBody<{ content: unknown }>(request);
      if (!body?.content || typeof body.content !== 'object') return json({ error: 'Missing content' }, 400);
      const text = JSON.stringify(body.content);
      if (text.length > 2_000_000) return json({ error: 'Rules are too large' }, 413);
      const now = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO content_draft (id, content, updated_at, updated_by) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
      )
        .bind(text, now, email)
        .run();
      return json({ updatedAt: now });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM content_draft').run();
      return json({ ok: true });
    }
  }

  if (path === 'publish' && method === 'POST') {
    const body = await readBody<{ content: unknown; note?: string }>(request);
    if (!body?.content) return json({ error: 'Missing content' }, 400);
    if (!body.note?.trim()) return json({ error: 'Write a note about what changed' }, 400);
    return publish(env, body.content, body.note.trim(), email);
  }

  if (path === 'history' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT version, published_at, published_by, note FROM content_versions ORDER BY version DESC LIMIT 200').all<VersionRow>();
    return json({ versions: results.map(toInfo) });
  }

  const versionMatch = /^versions\/(\d+)$/.exec(path);
  if (versionMatch && method === 'GET') {
    const row = await env.DB.prepare('SELECT version, content, published_at, published_by, note FROM content_versions WHERE version = ?')
      .bind(Number(versionMatch[1]))
      .first<VersionRow & { content: string }>();
    if (!row) return json({ error: 'Version not found' }, 404);
    return json({ ...toInfo(row), content: JSON.parse(row.content) });
  }

  if (path === 'rollback' && method === 'POST') {
    const body = await readBody<{ version: number; note?: string }>(request);
    if (!body || typeof body.version !== 'number') return json({ error: 'Missing version' }, 400);
    const row = await env.DB.prepare('SELECT content FROM content_versions WHERE version = ?').bind(body.version).first<{ content: string }>();
    if (!row) return json({ error: 'Version not found' }, 404);
    return publish(env, JSON.parse(row.content), body.note?.trim() || `Restored version ${body.version}`, email);
  }

  return json({ error: 'Not found' }, 404);
};
