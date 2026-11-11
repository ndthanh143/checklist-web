import { neonStore } from './neonStore.js';
import type { RulesStore } from './store.js';

declare const process: { env: Record<string, string | undefined> };

let store: RulesStore | null = null;

/** Postgres from the Vercel Neon integration (DATABASE_URL, or POSTGRES_URL). */
export function vercelStore(): RulesStore | null {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return (store ??= neonStore(url));
}
