import type { ServerEnv } from '../../server/http';

export interface Env extends ServerEnv {
  DB: D1Database;
}
