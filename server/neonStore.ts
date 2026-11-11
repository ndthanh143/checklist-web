import { neon } from '@neondatabase/serverless';
import type { DraftRow, RulesStore, VersionRow } from './store.js';

// Postgres (Neon) store for Vercel. Tables are created on first use, so no migration step is needed.

export function neonStore(databaseUrl: string): RulesStore {
  const sql = neon(databaseUrl);
  let ready: Promise<unknown> | null = null;
  const init = () =>
    (ready ??= sql
      .transaction([
        sql`CREATE TABLE IF NOT EXISTS content_versions (
          version INTEGER PRIMARY KEY,
          content TEXT NOT NULL,
          published_at TEXT NOT NULL,
          published_by TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT ''
        )`,
        sql`CREATE TABLE IF NOT EXISTS content_draft (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          updated_by TEXT NOT NULL
        )`,
      ])
      .catch((e) => {
        ready = null;
        throw e;
      }));

  return {
    async latestContent() {
      await init();
      const rows = (await sql`SELECT content FROM content_versions ORDER BY version DESC LIMIT 1`) as { content: string }[];
      return rows[0]?.content ?? null;
    },
    async getDraft() {
      await init();
      const rows = (await sql`SELECT content, updated_at, updated_by FROM content_draft WHERE id = 1`) as DraftRow[];
      return rows[0] ?? null;
    },
    async saveDraft(content, at, by) {
      await init();
      await sql`INSERT INTO content_draft (id, content, updated_at, updated_by) VALUES (1, ${content}, ${at}, ${by})
        ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`;
    },
    async deleteDraft() {
      await init();
      await sql`DELETE FROM content_draft`;
    },
    async maxVersion() {
      await init();
      const rows = (await sql`SELECT COALESCE(MAX(version), 0) AS v FROM content_versions`) as { v: number }[];
      return Number(rows[0]?.v ?? 0);
    },
    async publish(version, content, at, by, note) {
      await init();
      await sql.transaction([
        sql`INSERT INTO content_versions (version, content, published_at, published_by, note) VALUES (${version}, ${content}, ${at}, ${by}, ${note})`,
        sql`DELETE FROM content_draft`,
      ]);
    },
    async history(limit) {
      await init();
      return (await sql`SELECT version, published_at, published_by, note FROM content_versions ORDER BY version DESC LIMIT ${limit}`) as VersionRow[];
    },
    async getVersion(v) {
      await init();
      const rows = (await sql`SELECT version, content, published_at, published_by, note FROM content_versions WHERE version = ${v}`) as (VersionRow & { content: string })[];
      return rows[0] ?? null;
    },
  };
}
