import { handleAdminLogin } from '../../server/auth.js';
import type { Env } from '../lib/env.js';

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => handleAdminLogin(request, env);
