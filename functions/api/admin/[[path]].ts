import { handleAdmin } from '../../../server/handlers.js';
import type { Env } from '../../lib/env.js';
import { d1Store } from '../../lib/d1Store.js';

export const onRequest: PagesFunction<Env> = ({ request, env, params }) => {
  const path = (Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)).join('/');
  return handleAdmin(request, path, env, d1Store(env.DB));
};
