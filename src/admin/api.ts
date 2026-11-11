import type { ChecklistContent } from '../content/types';

export interface DraftResponse {
  content: ChecklistContent;
  updatedAt: string;
  updatedBy: string;
}

export interface VersionInfo {
  version: number;
  publishedAt: string;
  publishedBy: string;
  note: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!isJson) throw new ApiError('Server not available', 0);
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

export const adminApi = {
  me: () => call<{ email: string }>('/api/admin/me'),
  getDraft: () => call<DraftResponse | { draft: null }>('/api/admin/draft'),
  saveDraft: (content: ChecklistContent) => call<{ updatedAt: string }>('/api/admin/draft', { method: 'PUT', body: JSON.stringify({ content }) }),
  discardDraft: () => call<{ ok: true }>('/api/admin/draft', { method: 'DELETE' }),
  publish: (content: ChecklistContent, note: string) => call<VersionInfo>('/api/admin/publish', { method: 'POST', body: JSON.stringify({ content, note }) }),
  history: () => call<{ versions: VersionInfo[] }>('/api/admin/history'),
  getVersion: (v: number) => call<{ content: ChecklistContent } & VersionInfo>(`/api/admin/versions/${v}`),
  rollback: (v: number, note: string) => call<VersionInfo>('/api/admin/rollback', { method: 'POST', body: JSON.stringify({ version: v, note }) }),
  published: async (): Promise<ChecklistContent | null> => {
    const res = await fetch('/api/content', { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 204) return null;
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new ApiError('Server not available', 0);
    return (await res.json()) as ChecklistContent;
  },
};
