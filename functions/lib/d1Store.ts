import type { DraftRow, RulesStore, VersionRow } from '../../server/store';

/** Cloudflare D1 store (tables from migrations/0001_init.sql). */
export function d1Store(db: D1Database): RulesStore {
  return {
    async latestContent() {
      const row = await db.prepare('SELECT content FROM content_versions ORDER BY version DESC LIMIT 1').first<{ content: string }>();
      return row?.content ?? null;
    },
    getDraft: () => db.prepare('SELECT content, updated_at, updated_by FROM content_draft WHERE id = 1').first<DraftRow>(),
    async saveDraft(content, at, by) {
      await db
        .prepare(
          'INSERT INTO content_draft (id, content, updated_at, updated_by) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at, updated_by = excluded.updated_by',
        )
        .bind(content, at, by)
        .run();
    },
    async deleteDraft() {
      await db.prepare('DELETE FROM content_draft').run();
    },
    async maxVersion() {
      const row = await db.prepare('SELECT MAX(version) AS v FROM content_versions').first<{ v: number | null }>();
      return row?.v ?? 0;
    },
    async publish(version, content, at, by, note) {
      await db.batch([
        db.prepare('INSERT INTO content_versions (version, content, published_at, published_by, note) VALUES (?, ?, ?, ?, ?)').bind(version, content, at, by, note),
        db.prepare('DELETE FROM content_draft'),
      ]);
    },
    async history(limit) {
      const { results } = await db.prepare('SELECT version, published_at, published_by, note FROM content_versions ORDER BY version DESC LIMIT ?').bind(limit).all<VersionRow>();
      return results;
    },
    getVersion: (v) => db.prepare('SELECT version, content, published_at, published_by, note FROM content_versions WHERE version = ?').bind(v).first<VersionRow & { content: string }>(),
  };
}
