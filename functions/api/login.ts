import { handleLogin } from '../../server/auth';
import type { Env } from '../lib/env';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleLogin(request, env);
