import { handleContent } from '../../server/handlers.js';
import type { Env } from '../lib/env.js';
import { d1Store } from '../lib/d1Store.js';

export const onRequestGet: PagesFunction<Env> = ({ env }) => handleContent(d1Store(env.DB));
