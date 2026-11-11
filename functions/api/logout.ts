import { handleLogout } from '../../server/auth';
import type { Env } from '../lib/env';

export const onRequestGet: PagesFunction<Env> = () => handleLogout();
