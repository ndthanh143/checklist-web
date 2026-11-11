import { handleLogout } from '../server/auth';

export const config = { runtime: 'edge' };

export default function handler(): Response {
  return handleLogout();
}
