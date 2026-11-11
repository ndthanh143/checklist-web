import { handleLogout } from '../../server/auth.js';
import type { Env } from '../lib/env.js';

export const onRequestGet: PagesFunction<Env> = () => handleLogout();
