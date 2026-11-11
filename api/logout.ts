import { handleLogout } from '../server/auth.js';

export function GET(): Response {
  return handleLogout();
}
