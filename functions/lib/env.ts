import type { ServerEnv } from '../../server/http.js';

export interface Env extends ServerEnv {
  DB: D1Database;
}
