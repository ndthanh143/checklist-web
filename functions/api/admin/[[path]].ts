import { handleAdmin } from '../../../server/handlers';
import type { Env } from '../../lib/env';
import { d1Store } from '../../lib/d1Store';

export const onRequest: PagesFunction<Env> = ({ request, env, params }) => {
  const path = (Array.isArray(params.path) ? params.path : [params.path].filter(Boolean)).join('/');
  return handleAdmin(request, path, env, d1Store(env.DB));
};
