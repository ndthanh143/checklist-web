/** Where published rules and the shared draft are kept (D1 on Cloudflare, Postgres on Vercel). */

export interface VersionRow {
  version: number;
  published_at: string;
  published_by: string;
  note: string;
}

export interface DraftRow {
  content: string;
  updated_at: string;
  updated_by: string;
}

export interface RulesStore {
  latestContent(): Promise<string | null>;
  getDraft(): Promise<DraftRow | null>;
  saveDraft(content: string, at: string, by: string): Promise<void>;
  deleteDraft(): Promise<void>;
  maxVersion(): Promise<number>;
  /** Insert a version and clear the draft. Throws if the version already exists. */
  publish(version: number, content: string, at: string, by: string, note: string): Promise<void>;
  history(limit: number): Promise<VersionRow[]>;
  getVersion(version: number): Promise<(VersionRow & { content: string }) | null>;
}

/** In-memory store for tests. */
export function memoryStore(): RulesStore {
  const versions: (VersionRow & { content: string })[] = [];
  let draft: DraftRow | null = null;
  return {
    latestContent: async () => versions.at(-1)?.content ?? null,
    getDraft: async () => draft,
    saveDraft: async (content, at, by) => {
      draft = { content, updated_at: at, updated_by: by };
    },
    deleteDraft: async () => {
      draft = null;
    },
    maxVersion: async () => versions.at(-1)?.version ?? 0,
    publish: async (version, content, at, by, note) => {
      if (versions.some((v) => v.version === version)) throw new Error('conflict');
      versions.push({ version, content, published_at: at, published_by: by, note });
      draft = null;
    },
    history: async (limit) => [...versions].reverse().slice(0, limit),
    getVersion: async (v) => versions.find((x) => x.version === v) ?? null,
  };
}
