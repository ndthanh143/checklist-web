import type { ServerEnv } from './http.js';

declare const process: { env: Record<string, string | undefined> };

export function vercelEnv(): ServerEnv {
  const e = process.env;
  return {
    SITE_PASSWORD: e.SITE_PASSWORD,
    SESSION_SECRET: e.SESSION_SECRET,
    ADMIN_PASSWORD: e.ADMIN_PASSWORD,
    ADMIN_EMAILS: e.ADMIN_EMAILS,
  };
}
