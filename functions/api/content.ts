import { handleContent } from '../../server/handlers';
import type { Env } from '../lib/env';
import { d1Store } from '../lib/d1Store';

export const onRequestGet: PagesFunction<Env> = ({ env }) => handleContent(d1Store(env.DB));
